import { describe, expect, it } from 'vitest';
import { maskJson, maskText, renderDom, stripQuery, type DomNode } from './sanitize.js';

describe('maskText', () => {
  it('hides amounts, dates and merchant names, keeps UI labels', () => {
    expect(maskText('Consumos pendientes')).toBe('Consumos pendientes');
    expect(maskText('$ 1.234,56')).toBe('$ 9.999,99');
    expect(maskText('03/11/26 COTO Palermo')).toBe('99/99/99 XXXX Xxxxxxx');
    expect(maskText('Visa ···4509')).toBe('Visa ···9999');
    expect(maskText('Juan Pérez')).toBe('Xxxx Xxxxx');
  });
});

describe('maskJson', () => {
  it('keeps keys and types, masks values, cuts long arrays', () => {
    const out = maskJson({
      titular: 'JUAN PEREZ',
      importe: 12345.67,
      activa: true,
      movs: [1, 2, 3, 4, 5],
      '4509123412341234': 'x',
    });
    expect(out).toEqual({
      titular: 'XXXX XXXXX',
      importe: '#99999.99',
      activa: true,
      movs: ['#9', '#9', '#9', '… +2 más'],
      '9999999999999999': 'x',
    });
  });
});

describe('stripQuery', () => {
  it('drops query strings and long digit runs', () => {
    expect(stripQuery('https://bank.com/api/cuentas/12345678/movs?dni=30111222')).toBe('https://bank.com/api/cuentas/99999999/movs');
    expect(stripQuery('https://bank.com/app#/tarjetas?x=1')).toBe('https://bank.com/app#/tarjetas');
  });
});

describe('renderDom', () => {
  it('renders masked structure and collapses repeated rows', () => {
    const row = (t: string): DomNode => ({ tag: 'tr', attrs: { class: 'row' }, children: [t] });
    const tree: DomNode = {
      tag: 'table',
      attrs: { id: 'consumos-4509123412341234', 'aria-label': 'Consumos de Juan' },
      children: ['Total', row('COTO $ 100'), row('B'), row('C'), row('D'), row('E'), row('F')],
    };
    const out = renderDom(tree);
    expect(out).toContain('<table id="consumos-9999999999999999" aria-label="Consumos de Xxxx"> Total');
    expect(out).toContain('<tr class="row">XXXX $ 999');
    expect(out).toContain('… +2 hermanos repetidos');
    expect(out).not.toContain('COTO');
  });
});
