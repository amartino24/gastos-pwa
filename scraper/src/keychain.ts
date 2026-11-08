import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { BankId } from './banks/types.js';

const run = promisify(execFile);
const service = (bank: BankId) => `gastos-scraper.${bank}`;

/** Reads one credential field from the macOS login Keychain. Never logged. */
export async function readSecret(bank: BankId, field: string): Promise<string> {
  try {
    const { stdout } = await run('security', ['find-generic-password', '-s', service(bank), '-a', field, '-w']);
    return stdout.replace(/\n$/, '');
  } catch {
    // Deliberately drop the original error: keep the output of `security` out of logs.
    throw new Error(`Falta "${field}" de ${bank} en el Llavero. Corré: npm run setup`);
  }
}

/**
 * Stores one field. `-w` goes last with no value, so `security` itself prompts
 * on the terminal (hidden input): the secret never passes through this process or argv.
 */
export function promptAndStoreSecret(bank: BankId, field: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(
      `\n▶ Escribí tu ${label.toUpperCase()} de ${bank} cuando macOS diga "password data" y de nuevo en "retype" (no se ve al escribir):`,
    );
    const child = spawn(
      'security',
      ['add-generic-password', '-U', '-s', service(bank), '-a', field, '-l', `Gastos scraper · ${bank} · ${label}`, '-w'],
      { stdio: 'inherit' },
    );
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`No se guardó ${label} (security salió con ${code})`))));
  });
}
