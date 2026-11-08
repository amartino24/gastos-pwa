/**
 * Run in YOUR terminal (not through Claude). Credentials are typed straight into
 * macOS `security` prompts and stored in the login Keychain.
 */
import { access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { ADAPTERS } from './banks/index.js';
import type { BankId } from './banks/types.js';
import { PATHS, loadConfig, saveConfig } from './config.js';
import { promptAndStoreSecret } from './keychain.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const previous = await loadConfig().catch(() => null);

const uidAnswer = await rl.question(
  `uid de Firebase de tu usuario (Firebase console → Authentication)${previous ? ` [${previous.uid}]` : ''}: `,
);
const uid = uidAnswer.trim() || previous?.uid || '';
if (!uid) throw new Error('uid requerido');

const banks: BankId[] = [];
const toStore: BankId[] = [];
for (const adapter of Object.values(ADAPTERS)) {
  const yes = (await rl.question(`¿Usar ${adapter.name}? [s/N]: `)).trim().toLowerCase().startsWith('s');
  if (!yes) continue;
  banks.push(adapter.id);
  const store = (await rl.question(`¿Cargar/actualizar credenciales de ${adapter.name} en el Llavero? [s/N]: `)).trim().toLowerCase();
  if (store.startsWith('s')) toStore.push(adapter.id);
}
// Close readline before handing the terminal to `security` for hidden input.
rl.close();

for (const bank of toStore) {
  for (const f of ADAPTERS[bank].credentialFields) await promptAndStoreSecret(bank, f.key, f.label);
}

await saveConfig({ uid, banks });
console.log(`\nConfig guardada en ${PATHS.config} (bancos: ${banks.join(', ') || 'ninguno'}).`);

try {
  await access(PATHS.serviceAccount);
  console.log('Clave de Firebase: OK');
} catch {
  console.log(`Falta la clave de Firebase: bajala (ver README) y guardala en ${PATHS.serviceAccount} con chmod 600.`);
}
