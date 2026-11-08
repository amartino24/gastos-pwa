/**
 * Opens the bank in a visible browser with the scraper's own profile. YOU log in
 * by hand; nothing is typed by this script. Each Enter saves a *masked* snapshot
 * of the current page (structure + UI labels, no amounts/names/merchants) and of
 * the JSON responses seen so far, under scraper/.discover/<bank>/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chromium, type Response } from 'playwright';
import { adapterFor } from './banks/index.js';
import { DISCOVER_DIR, PATHS, ensureHome } from './config.js';
import { SERIALIZE_DOM_JS, maskJson, renderDom, stripQuery, type DomNode } from './sanitize.js';

const adapter = adapterFor(process.argv[2]);
await ensureHome();

const outDir = join(DISCOVER_DIR, adapter.id, new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(outDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(PATHS.profile(adapter.id), {
  headless: false,
  viewport: null,
  locale: 'es-AR',
});

const xhr: unknown[] = [];
ctx.on('response', async (res: Response) => {
  if (!(res.headers()['content-type'] ?? '').includes('json')) return;
  try {
    // Response bodies only — request bodies (which carry the password) are never read.
    xhr.push({ method: res.request().method(), status: res.status(), url: stripQuery(res.url()), body: maskJson(await res.json()) });
  } catch {
    /* empty / non-JSON body */
  }
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(adapter.startUrl);

console.log(`
${adapter.name} abierto. Pasos:
  1. Enter AHORA, antes de escribir nada → captura la pantalla de login.
  2. Logueate a mano en la ventana.
  3. Andá a consumos de tarjeta / pendientes / cuotas / último resumen y en cada pantalla dale Enter.
  4. "q" + Enter para terminar.
Salida (enmascarada): ${outDir}
`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
let shot = 0;
for (;;) {
  const answer = (await rl.question(`[${shot}] Enter = capturar · q = salir: `)).trim().toLowerCase();
  if (answer === 'q') break;
  shot++;
  let pageIdx = 0;
  for (const p of ctx.pages()) {
    pageIdx++;
    let frameIdx = 0;
    for (const frame of p.frames()) {
      frameIdx++;
      try {
        const tree = (await frame.evaluate(SERIALIZE_DOM_JS)) as DomNode | null;
        if (!tree) continue;
        const name = `${String(shot).padStart(2, '0')}-page${pageIdx}-frame${frameIdx}.txt`;
        await writeFile(join(outDir, name), `URL: ${stripQuery(frame.url())}\n\n${renderDom(tree)}`);
      } catch {
        /* detached / cross-origin frame mid-navigation */
      }
    }
  }
  await writeFile(join(outDir, 'xhr.json'), JSON.stringify(xhr, null, 2));
  console.log(`   guardado #${shot} (${xhr.length} respuestas JSON hasta ahora)`);
}

rl.close();
await ctx.close();
console.log(`Listo. Revisá ${outDir} si querés y avisale a Claude.`);
