/**
 * Masking for discover dumps: keeps page *structure* and generic UI labels so
 * selectors can be written, but hides every amount, date, number, name and merchant.
 */

/** Generic homebanking UI words that are safe to keep verbatim (lowercase). */
const KEEP_WORDS = new Set(
  `a al el la los las lo de del en y o u por para con sin su sus mi mis ver más mas menos ir volver
  ingresar ingreso iniciar sesión sesion salir continuar aceptar cancelar cerrar siguiente anterior buscar filtrar descargar imprimir
  usuario clave contraseña dni documento tipo número numero olvidé olvide recordar
  inicio home cuentas cuenta tarjeta tarjetas crédito credito débito debito visa mastercard master amex american express
  consumo consumos pendiente pendientes autorizaciones autorizados movimiento movimientos último últimos ultimo ultimos
  resumen resúmenes resumenes cierre cierres vencimiento vencimientos próximo proximo próxima proxima actual actuales período periodo
  fecha fechas descripción descripcion detalle detalles establecimiento comercio comprobante cupón cupon moneda monto montos importe importes
  total totales saldo saldos pago pagos pagar mínimo minimo disponible límite limite compra compras cuota cuotas plan
  pesos peso dólares dolares dólar dolar ars usd us s
  titular adicional adicionales estado estados hoy ayer día dia días dias mes meses
  impuestos impuesto iva percepción percepcion sellos intereses cargo cargos devolución devolucion
  enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre`
    .split(/\s+/)
    .filter(Boolean),
);

function maskWord(word: string): string {
  if (word.length <= 1 && !/\d/.test(word)) return word;
  if (KEEP_WORDS.has(word.toLowerCase())) return word;
  return word.replace(/\d/g, '9').replace(/\p{Lu}/gu, 'X').replace(/\p{Ll}|\p{Lo}/gu, 'x');
}

/** "$ 1.234,56 COTO 03/11/26" → "$ 9.999,99 XXXX 99/99/99" */
export function maskText(text: string): string {
  return text.replace(/[\p{L}\p{N}]+/gu, maskWord);
}

/** Only hides long digit runs (account/card numbers) — for ids, classes and paths. */
export function maskDigits(text: string): string {
  return text.replace(/\d{4,}/g, m => '9'.repeat(m.length));
}

const MAX_ARRAY_ITEMS = 3;

/** Keeps JSON keys and types; masks values. Long arrays are cut to a few items. */
export function maskJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map(maskJson);
    if (value.length > MAX_ARRAY_ITEMS) items.push(`… +${value.length - MAX_ARRAY_ITEMS} más`);
    return items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [/\d/.test(k) ? maskText(k) : k, maskJson(v)]));
  }
  if (typeof value === 'string') return maskText(value);
  if (typeof value === 'number') return `#${maskText(String(value))}`;
  return value; // boolean / null
}

export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return maskDigits(`${u.origin}${u.pathname}${u.hash.replace(/\?.*$/, '')}`);
  } catch {
    return maskDigits(url.replace(/\?.*$/, ''));
  }
}

export interface DomNode {
  tag: string;
  attrs: Record<string, string>;
  hidden?: boolean;
  children: (DomNode | string)[];
}

/**
 * Runs inside the page. Plain JS string on purpose: tsx/esbuild would inject
 * helpers (__name) into a TS function that don't exist in the browser.
 * Never reads input values.
 */
export const SERIALIZE_DOM_JS = `(() => {
  const KEEP = ['id','class','role','name','type','for','aria-label','placeholder','title','data-testid','href','formcontrolname','ng-reflect-name'];
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','LINK','META','TEMPLATE','IFRAME']);
  const walk = (el) => {
    const node = { tag: el.tagName.toLowerCase(), attrs: {}, children: [] };
    for (const a of KEEP) { const v = el.getAttribute(a); if (v) node.attrs[a] = v; }
    if (el.checkVisibility && !el.checkVisibility()) node.hidden = true;
    const kids = [...(el.shadowRoot ? el.shadowRoot.childNodes : []), ...el.childNodes];
    for (const c of kids) {
      if (c.nodeType === 3) { const t = c.textContent.replace(/\\s+/g, ' ').trim(); if (t) node.children.push(t); }
      else if (c.nodeType === 1 && !SKIP.has(c.tagName.toUpperCase())) node.children.push(walk(c));
    }
    return node;
  };
  return document.body ? walk(document.body) : null;
})()`;

const TEXT_ATTRS = new Set(['aria-label', 'placeholder', 'title']);
const MAX_SIBLINGS_SAME_TAG = 4;

function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => {
      const masked = TEXT_ATTRS.has(k) ? maskText(v) : k === 'href' ? stripQuery(v) : maskDigits(v);
      return ` ${k}="${masked}"`;
    })
    .join('');
}

/** Masked, indented pseudo-HTML. Repeated rows (tables/lists) are cut after a few. */
export function renderDom(node: DomNode, depth = 0): string {
  const pad = '  '.repeat(depth);
  const open = `${pad}<${node.tag}${renderAttrs(node.attrs)}${node.hidden ? ' ·hidden' : ''}>`;
  const texts = node.children.filter((c): c is string => typeof c === 'string');
  const elements = node.children.filter((c): c is DomNode => typeof c !== 'string');
  if (elements.length === 0) return `${open}${texts.map(maskText).join(' ')}\n`;

  let out = `${open}${texts.length ? ' ' + texts.map(maskText).join(' ') : ''}\n`;
  const seen = new Map<string, number>();
  let skipped = 0;
  for (const child of elements) {
    const key = `${child.tag}.${child.attrs['class'] ?? ''}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > MAX_SIBLINGS_SAME_TAG) {
      skipped++;
      continue;
    }
    out += renderDom(child, depth + 1);
  }
  if (skipped) out += `${pad}  … +${skipped} hermanos repetidos\n`;
  return out;
}
