/**
 * Drives the local Android emulator through adb to read an app's screens via the
 * accessibility tree (uiautomator dump). Read-only navigation: taps, swipes, back.
 */
import { execFile, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SDK = process.env['ANDROID_SDK_ROOT'] ?? join(homedir(), 'Library', 'Android', 'sdk');
const ADB = join(SDK, 'platform-tools', 'adb');
const EMULATOR = join(SDK, 'emulator', 'emulator');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface UiNode {
  text: string;
  desc: string;
  /** resource-id without the package prefix ("lockPattern"). */
  id: string;
  clickable: boolean;
  /** [x1, y1, x2, y2] */
  bounds: [number, number, number, number];
}

async function adb(...args: string[]): Promise<string> {
  const { stdout } = await run(ADB, args, { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

async function booted(): Promise<boolean> {
  try {
    const devices = await adb('devices');
    if (!/emulator-\d+\s+device/.test(devices)) return false;
    return (await adb('shell', 'getprop', 'sys.boot_completed')).trim() === '1';
  } catch {
    return false;
  }
}

/** Boots the AVD headless if no emulator is up. Returns true when it started it (so the caller stops it). */
export async function ensureEmulator(avd: string): Promise<boolean> {
  if (await booted()) return false;
  spawn(EMULATOR, ['-avd', avd, '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot-save'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  await adb('start-server').catch(() => {});
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (await booted()) return true;
    await sleep(2_000);
  }
  throw new Error('android: el emulador no arrancó');
}

export async function stopEmulator(): Promise<void> {
  await adb('emu', 'kill').catch(() => {});
}

/** XML of `uiautomator dump` → nodes with text, content-desc, bounds (document order). */
export function parseUiXml(xml: string): UiNode[] {
  const unescape = (s: string) =>
    s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const attr = (node: string, name: string) => unescape(node.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? '');
  return [...xml.matchAll(/<node [^>]*>/g)].map(([node]) => {
    const b = attr(node, 'bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    return {
      text: attr(node, 'text'),
      desc: attr(node, 'content-desc'),
      id: attr(node, 'resource-id').split('/').pop() ?? '',
      clickable: attr(node, 'clickable') === 'true',
      bounds: b ? [+b[1]!, +b[2]!, +b[3]!, +b[4]!] : [0, 0, 0, 0],
    };
  });
}

export async function dumpUi(): Promise<UiNode[]> {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/gastos-ui.xml');
  return parseUiXml(await adb('exec-out', 'cat', '/sdcard/gastos-ui.xml'));
}

/** Dumps until `ready(nodes)` holds (screens load async). */
export async function waitForUi(ready: (nodes: UiNode[]) => boolean, timeoutMs = 30_000): Promise<UiNode[]> {
  const deadline = Date.now() + timeoutMs;
  let last: UiNode[] = [];
  while (Date.now() < deadline) {
    last = await dumpUi().catch(() => []);
    if (ready(last)) return last;
    await sleep(1_500);
  }
  throw new Error('android: la pantalla esperada no cargó');
}

/** Fresh start on the app's home: force-stop first (keeps the login), then launch. */
export async function launchApp(pkg: string): Promise<void> {
  await adb('shell', 'am', 'force-stop', pkg);
  await sleep(1_000);
  await adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
}

export async function tapNode(node: UiNode): Promise<void> {
  const [x1, y1, x2, y2] = node.bounds;
  await adb('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
}

export async function swipe(x1: number, y1: number, x2: number, y2: number, ms = 400): Promise<void> {
  await adb('shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(ms));
}

/** "1-4-7-8-9" → centers of those dots in a 3×3 pattern grid with the given bounds. */
export function patternPoints(pattern: string, bounds: UiNode['bounds']): [number, number][] {
  const dots = pattern.split(/\D+/).filter(Boolean).map(Number);
  if (dots.length < 4 || dots.some(d => d < 1 || d > 9)) throw new Error('el patrón tiene que ser de 4 a 9 puntos del 1 al 9 (ej. 1-4-7-8-9)');
  const [x1, y1, x2, y2] = bounds;
  const cw = (x2 - x1) / 3;
  const ch = (y2 - y1) / 3;
  return dots.map(d => {
    const col = (d - 1) % 3;
    const row = Math.floor((d - 1) / 3);
    return [Math.round(x1 + cw * (col + 0.5)), Math.round(y1 + ch * (row + 0.5))];
  });
}

/** Draws a pattern as one continuous finger gesture (down, moves through every dot, up). */
export async function drawPattern(pattern: string, bounds: UiNode['bounds']): Promise<void> {
  const pts = patternPoints(pattern, bounds);
  const [sx, sy] = pts[0]!;
  await adb('shell', 'input', 'motionevent', 'DOWN', String(sx), String(sy));
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    for (let s = 1; s <= 4; s++) {
      const x = Math.round(ax + ((bx - ax) * s) / 4);
      const y = Math.round(ay + ((by - ay) * s) / 4);
      await adb('shell', 'input', 'motionevent', 'MOVE', String(x), String(y));
    }
  }
  const [ex, ey] = pts[pts.length - 1]!;
  await adb('shell', 'input', 'motionevent', 'UP', String(ex), String(ey));
}

/** Screen on; if Android's lock screen shows, swipe up to bring its pattern. */
export async function wakeAndRevealLock(): Promise<void> {
  await adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  await sleep(800);
  const win = await adb('shell', 'dumpsys', 'window').catch(() => '');
  if (/mShowingLockscreen=true|isKeyguardShowing=true|mKeyguardShowing=true/.test(win)) {
    await swipe(672, 2600, 672, 900, 300);
    await sleep(1_000);
  }
}

export async function back(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(800);
  }
}
