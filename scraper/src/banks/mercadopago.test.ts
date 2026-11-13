import { describe, expect, it } from 'vitest';
import { parseUiXml, type UiNode } from '../android.js';
import { isLoginScreen, parseHomeBalance, parseStatement, patternGrid } from './mercadopago.js';
import { patternPoints } from '../android.js';

const node = (text: string, desc = '', id = ''): UiNode => ({ text, desc, id, clickable: false, bounds: [0, 0, 0, 0] });

describe('mercadopago app parsing', () => {
  it('reads the home balance', () => {
    expect(parseHomeBalance([node('', 'Saldo, 1.664 pesos con 33 centavos Rinde 19.8%  Los últimos 12 meses …')]))
      .toEqual({ ARS: 1664.33, USD: 0 });
    expect(parseHomeBalance([node('Hola')])).toBeNull();
  });

  it('reads the statement: dates, totals and movements with cuotas', () => {
    const s = parseStatement([
      node('Resúmenes'),
      node('Noviembre'),
      node('', '1000 pesos argentinos con 5 centavos'),
      node('', '2 dólares'),
      node('Cierra el 18/nov · Vence el 24/nov Detalle de tu resumen'),
      node('', 'Diciembre, deuda 308.570 pesos argentinos'),
      node('Movimientos'),
      node('7 de noviembre'),
      node('NEGOCIO M'), node('', '-28900 pesos argentinos'), node('cargo'), node('Consumo'),
      node('20 de octubre'),
      node('The ToyCompany S R L'), node('', '-24983 pesos argentinos con 35 centavos'), node('cargo'), node('Consumo'), node('Cuota 1 de 6'),
      node('2 de octubre'),
      node('Devolución tienda'), node('', '500 pesos argentinos'), node('abono'),
    ], new Date('2026-11-13T12:00:00'));

    expect(s).toMatchObject({ cierre: '2026-11-18', vencimiento: '2026-11-24', totalBanco: { ARS: 1000.05, USD: 2 } });
    expect(s.pendientes).toEqual([
      { fecha: '2026-11-07', descripcion: 'NEGOCIO M', moneda: 'ARS', monto: 28900 },
      { fecha: '2026-10-20', descripcion: 'The ToyCompany S R L', moneda: 'ARS', monto: 24983.35, cuota: { actual: 1, total: 6 } },
      { fecha: '2026-10-02', descripcion: 'Devolución tienda', moneda: 'ARS', monto: -500 },
    ]);
  });

  it('puts December/January dates in the right year around new year', () => {
    const s = parseStatement([
      node('Cierra el 18/ene · Vence el 24/ene'),
      node('Movimientos'),
      node('28 de diciembre'), node('X'), node('', '-10 pesos argentinos'),
    ], new Date('2027-01-10T12:00:00'));
    expect(s.cierre).toBe('2027-01-18');
    expect(s.pendientes[0]!.fecha).toBe('2026-12-28');
  });

  it('detects the login screen', () => {
    expect(isLoginScreen([node('Iniciar sesión')])).toBe(true);
    expect(isLoginScreen([node('Ingresar'), node('', 'Saldo, 1 pesos')])).toBe(false);
  });

  it('parses a uiautomator dump', () => {
    const xml = '<hierarchy><node index="0" text="A &amp; B" resource-id="" class="x" content-desc="d" clickable="true" bounds="[1,2][3,4]" /></hierarchy>';
    expect(parseUiXml(xml)).toEqual([{ text: 'A & B', desc: 'd', id: '', clickable: true, bounds: [1, 2, 3, 4] }]);
  });

  it('finds the pattern grid and maps dots to its 3×3 centers', () => {
    expect(patternGrid([node('', '', 'lockPattern')])).toBeDefined();
    expect(patternGrid([node('Desbloqueá con PIN o patrón')])).toBeUndefined();
    expect(patternPoints('1-5-9-6', [150, 1344, 1194, 2388])).toEqual([[324, 1518], [672, 1866], [1020, 2214], [1020, 1866]]);
    expect(() => patternPoints('1-2', [0, 0, 300, 300])).toThrow();
    expect(() => patternPoints('1-2-3-0', [0, 0, 300, 300])).toThrow();
  });
});
