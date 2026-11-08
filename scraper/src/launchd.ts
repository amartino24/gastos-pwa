/**
 * Installs a user LaunchAgent: runs at login and every hour; scrape.ts itself
 * skips a bank that already succeeded in the last 20h. If the Mac sleeps,
 * launchd fires once on wake — the Mac does not need to stay on.
 */
import { execFile } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { PATHS, SCRAPER_DIR, ensureHome } from './config.js';

const run = promisify(execFile);
const domain = `gui/${process.getuid?.() ?? ''}`;
const agentsDir = join(homedir(), 'Library', 'LaunchAgents');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Agent {
  label: string;
  script: string;
  log: string;
  /** Hourly scheduled run vs. always-on listener. */
  keepAlive: boolean;
}

const AGENTS: Agent[] = [
  { label: 'com.gastos.scraper', script: 'scrape.ts', log: 'scrape.log', keepAlive: false },
  { label: 'com.gastos.scraper-watch', script: 'watch.ts', log: 'watch.log', keepAlive: true },
];

function plist(a: Agent): string {
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const program = [process.execPath, tsxCli, join(SCRAPER_DIR, 'src', a.script)];
  const schedule = a.keepAlive
    ? '<key>KeepAlive</key><true/>\n  <key>ThrottleInterval</key><integer>60</integer>'
    : '<key>StartInterval</key><integer>3600</integer>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${a.label}</string>
  <key>ProgramArguments</key>
  <array>${program.map(p => `<string>${esc(p)}</string>`).join('')}</array>
  <key>WorkingDirectory</key><string>${esc(SCRAPER_DIR)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${esc(dirname(process.execPath))}:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  ${schedule}
  <key>StandardOutPath</key><string>${esc(join(PATHS.logs, a.log))}</string>
  <key>StandardErrorPath</key><string>${esc(join(PATHS.logs, a.log))}</string>
</dict>
</plist>
`;
}

const plistPath = (a: Agent) => join(agentsDir, `${a.label}.plist`);
const bootout = (a: Agent) => run('launchctl', ['bootout', `${domain}/${a.label}`]).catch(() => {});

const cmd = process.argv[2];
if (cmd === 'install') {
  await ensureHome();
  for (const a of AGENTS) {
    await bootout(a);
    await writeFile(plistPath(a), plist(a));
    await run('launchctl', ['bootstrap', domain, plistPath(a)]);
    console.log(`Instalado: ${a.label} → log ${join(PATHS.logs, a.log)}`);
  }
} else if (cmd === 'uninstall') {
  for (const a of AGENTS) {
    await bootout(a);
    await rm(plistPath(a), { force: true });
  }
  console.log('Desinstalado.');
} else {
  console.log('Uso: tsx src/launchd.ts install|uninstall');
}
