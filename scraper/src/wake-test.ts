/**
 * Tests the scheduled-wake flow end to end, now:
 *   npm run test:wake [-- banco]  → schedules a real run (default galicia) + a Mac wake 3 min from now
 *   npm run test:wake -- result  → shows what happened and removes the test job
 * Run it in YOUR terminal: `pmset schedule` asks for your admin password.
 */
import { execFile, spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { adapterFor } from './banks/index.js';
import { PATHS, SCRAPER_DIR, ensureHome } from './config.js';

const run = promisify(execFile);
const LABEL = 'com.gastos.scraper-waketest';
const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const logPath = join(PATHS.logs, 'wake-test.log');
const domain = `gui/${process.getuid?.() ?? ''}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pad = (n: number) => String(n).padStart(2, '0');

async function removeJob(): Promise<void> {
  await run('launchctl', ['bootout', `${domain}/${LABEL}`]).catch(() => {});
  await rm(plistPath, { force: true });
}

if (process.argv[2] === 'result') {
  // Don't kill a run that resumed when the lid was opened: removing the job would stop it.
  const status = await run('launchctl', ['print', `${domain}/${LABEL}`]).then(r => r.stdout, () => '');
  if (/state = running/.test(status)) {
    console.log('La corrida de prueba todavía está corriendo. Esperá unos segundos y volvé a correr este comando.');
    process.exit(0);
  }
  const log = await readFile(logPath, 'utf8').catch(() => '');
  const lines = log.split('\n').filter(l => l && !l.includes('`credentials` option'));
  console.log(lines.length ? lines.slice(-6).join('\n') : 'Todavía no hay resultado: la corrida de prueba no se ejecutó.');
  await removeJob();
  console.log('\nCorrida de prueba eliminada.');
} else {
  await ensureHome();
  await rm(logPath, { force: true });
  const at = new Date(Date.now() + 3 * 60_000);
  at.setSeconds(0, 0);
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const bank = adapterFor(process.argv[2] ?? 'galicia').id;
  const program = [process.execPath, tsxCli, join(SCRAPER_DIR, 'src', 'scrape.ts'), '--force', `--bank=${bank}`];
  await removeJob();
  await writeFile(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>${program.map(p => `<string>${esc(p)}</string>`).join('')}</array>
  <key>WorkingDirectory</key><string>${esc(SCRAPER_DIR)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${esc(dirname(process.execPath))}:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>${at.getHours()}</integer><key>Minute</key><integer>${at.getMinutes()}</integer></dict>
  <key>StandardOutPath</key><string>${esc(logPath)}</string>
  <key>StandardErrorPath</key><string>${esc(logPath)}</string>
</dict>
</plist>
`);
  await run('launchctl', ['bootstrap', domain, plistPath]);

  const when = `${pad(at.getMonth() + 1)}/${pad(at.getDate())}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}:00`;
  console.log(`Prueba con ${bank}.`);
  console.log(`Programando el despertar para las ${pad(at.getHours())}:${pad(at.getMinutes())} (te pide la contraseña de tu Mac):`);
  const code = await new Promise<number>(resolve => {
    spawn('sudo', ['pmset', 'schedule', 'wake', when], { stdio: 'inherit' }).on('exit', c => resolve(c ?? 1));
  });
  if (code !== 0) {
    await removeJob();
    throw new Error('No se pudo programar el despertar.');
  }
  console.log(`
Listo. Ahora:
  1. Desenchufala si querés probar a batería.
  2. Cerrá la tapa (o menú  → Suspender) antes de las ${pad(at.getHours())}:${pad(at.getMinutes())}.
  3. Esperá hasta las ${pad(at.getHours())}:${pad((at.getMinutes() + 3) % 60)} más o menos y abrila.
  4. Corré:  npm --prefix scraper run test:wake -- result
`);
}
