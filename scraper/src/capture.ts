import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { PATHS } from './config.js';
import { SERIALIZE_DOM_JS, maskJson, renderDom, stripQuery, type DomNode } from './sanitize.js';

/**
 * Records the JSON responses a page loads, masked (no amounts, names or numbers),
 * plus its masked DOM, to logs/<name>.json. Used to learn a new section's API.
 */
export async function captureMasked(page: Page, name: string, navigate: () => Promise<unknown>): Promise<void> {
  const ctx = page.context();
  const xhr: unknown[] = [];
  const onResponse = async (r: import('playwright').Response) => {
    if (!(r.headers()['content-type'] ?? '').includes('json')) return;
    try {
      xhr.push({ method: r.request().method(), url: stripQuery(r.url()), body: maskJson(await r.json()) });
    } catch {
      /* ignore */
    }
  };
  ctx.on('response', onResponse);
  try {
    await navigate();
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(3_000);
    const live = ctx.pages().filter(p => !p.isClosed()).at(-1) ?? page;
    const dom: string[] = [];
    for (const frame of live.frames()) {
      const tree = (await frame.evaluate(SERIALIZE_DOM_JS).catch(() => null)) as DomNode | null;
      if (tree) dom.push(`URL: ${stripQuery(frame.url())}\n\n${renderDom(tree)}`);
    }
    await writeFile(join(PATHS.logs, `${name}.json`), JSON.stringify({ url: stripQuery(live.url()), xhr, dom }, null, 2), {
      mode: 0o600,
    });
  } finally {
    ctx.off('response', onResponse);
  }
}
