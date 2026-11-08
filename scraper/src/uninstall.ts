/**
 * Undoes everything the scraper set up on this Mac. Run it in YOUR terminal (asks
 * for your admin password once).
 *   npm run uninstall            → launchd agents, daily wake, sudo rule; sleep back to normal
 *   npm run uninstall -- --all   → also Keychain credentials, Firebase key, browser profiles, logs
 * Data already in Firestore is left untouched.
 */
import { execFile, spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { ADAPTERS } from './banks/index.js';
import { HOME_DIR } from './config.js';

const run = promisify(execFile);
const domain = `gui/${process.getuid?.() ?? ''}`;
const LABELS = ['com.gastos.scraper', 'com.gastos.scraper-watch', 'com.gastos.scraper-waketest'];
const all = process.argv.includes('--all');

const sudo = (args: string[]) =>
  new Promise<boolean>(resolve => spawn('sudo', args, { stdio: 'inherit' }).on('exit', c => resolve(c === 0)));
const ok = (done: boolean, what: string) => console.log(`${done ? '✓' : '✗'} ${what}`);

if (all) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Esto borra también tus credenciales del Llavero, la clave de Firebase y los perfiles. ¿Seguro? [s/N]: ')).trim();
  rl.close();
  if (!/^s/i.test(answer)) {
    console.log('Cancelado.');
    process.exit(0);
  }
}

// 1. launchd agents (hourly/07:02 run, watcher, leftover wake test)
for (const label of LABELS) {
  await run('launchctl', ['bootout', `${domain}/${label}`]).catch(() => {});
  await rm(join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`), { force: true });
}
ok(true, 'Tareas automáticas (launchd) eliminadas');

// 2. System changes (one sudo prompt, then cached)
console.log('Ahora te pide la contraseña de tu Mac para deshacer los cambios del sistema:');
ok(await sudo(['/usr/bin/pmset', 'disablesleep', '0']), 'Sueño del sistema en normal');
ok(await sudo(['/usr/bin/pmset', 'repeat', 'cancel']), 'Despertar diario de las 07:00 cancelado');
ok(await sudo(['rm', '-f', '/etc/sudoers.d/gastos-scraper']), 'Permiso de sudo eliminado');

// 3. Local data, only with --all
if (all) {
  for (const adapter of Object.values(ADAPTERS)) {
    for (const f of adapter.credentialFields) {
      await run('security', ['delete-generic-password', '-s', `gastos-scraper.${adapter.id}`, '-a', f.key]).catch(() => {});
    }
  }
  ok(true, 'Credenciales del Llavero eliminadas');
  await rm(HOME_DIR, { recursive: true, force: true });
  ok(true, `Clave de Firebase, perfiles y logs eliminados (${HOME_DIR})`);
}

console.log(`\nListo.${all ? '' : ' Tus credenciales y la clave siguen guardadas: para reinstalar, npm run launchd:install.'}`);
console.log('Los datos en Firestore no se tocaron.');
