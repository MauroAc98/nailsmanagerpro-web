import { describe, expect, it } from 'vitest';
import { celdasDeMes, desfaseLunes, etiquetaDeDia, etiquetaDeMes, inicialesDeSemana, mesAnterior, mesDe, mesSiguiente, mesValido, primerDia, ultimoDia } from './mes';

describe('mesValido', () => {
  it.each([
    ['2026-10', true],
    ['2000-01', true],
    ['1999-12', false],
    ['2026-13', false],
    ['2026-00', false],
    ['2026-1', false],
    ['2026-10-01', false],
    ['', false],
  ])('%s -> %s', (mes, esperado) => {
    expect(mesValido(mes)).toBe(esperado);
  });

  it('un valor que no es texto no es un mes', () => {
    expect(mesValido(undefined as unknown as string)).toBe(false);
  });
});

describe('mesDe', () => {
  it('toma el mes de una fecha válida', () => {
    expect(mesDe('2026-10-17')).toBe('2026-10');
  });
  it('fecha inválida -> null', () => {
    expect(mesDe('2026-02-30')).toBeNull();
    expect(mesDe('basura')).toBeNull();
  });
});

describe('mesAnterior / mesSiguiente', () => {
  it('cruza el año hacia atrás y hacia adelante', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesSiguiente('2025-12')).toBe('2026-01');
    expect(mesAnterior('2026-10')).toBe('2026-09');
    expect(mesSiguiente('2026-10')).toBe('2026-11');
  });
  it('no baja de 2000-01', () => {
    expect(mesAnterior('2000-01')).toBeNull();
    expect(mesAnterior('2000-02')).toBe('2000-01');
  });
  it('entrada inválida -> null', () => {
    expect(mesAnterior('x')).toBeNull();
    expect(mesSiguiente('2026-13')).toBeNull();
  });
});

describe('primerDia / ultimoDia', () => {
  it('primer día', () => {
    expect(primerDia('2026-10')).toBe('2026-10-01');
  });
  it.each([
    ['2024-02', '2024-02-29'],
    ['2100-02', '2100-02-28'],
    ['2000-02', '2000-02-29'],
    ['2026-02', '2026-02-28'],
    ['2026-04', '2026-04-30'],
    ['2026-12', '2026-12-31'],
  ])('último día de %s', (mes, esperado) => {
    expect(ultimoDia(mes)).toBe(esperado);
  });
  it('entrada inválida -> null', () => {
    expect(primerDia('2026-13')).toBeNull();
    expect(ultimoDia('x')).toBeNull();
  });
});

describe('etiquetaDeMes', () => {
  it('nombre del mes y año en el idioma pedido, sin correrse por la zona horaria', () => {
    expect(etiquetaDeMes('2026-10', 'es')).toBe('octubre de 2026');
    expect(etiquetaDeMes('2026-01', 'es')).toBe('enero de 2026');
    expect(etiquetaDeMes('2026-10', 'pt-BR')).toBe('outubro de 2026');
  });
  it('entrada inválida -> texto vacío', () => {
    expect(etiquetaDeMes('x', 'es')).toBe('');
  });
});

describe('desfaseLunes', () => {
  it('cuenta los huecos antes del día 1 con la semana desde el lunes', () => {
    expect(desfaseLunes('2026-10')).toBe(3); // 1/10/2026 es jueves
    expect(desfaseLunes('2026-06')).toBe(0); // 1/6/2026 es lunes
    expect(desfaseLunes('2026-02')).toBe(6); // 1/2/2026 es domingo
  });
  it('entrada inválida -> null', () => {
    expect(desfaseLunes('x')).toBeNull();
  });
});

describe('celdasDeMes', () => {
  it('arma 42 celdas desde el lunes, con los días de los meses vecinos marcados como ajenos', () => {
    const celdas = celdasDeMes('2026-10') ?? [];
    expect(celdas).toHaveLength(42);
    expect(celdas[0]).toEqual({ fecha: '2026-09-28', delMes: false });
    expect(celdas[3]).toEqual({ fecha: '2026-10-01', delMes: true });
    expect(celdas[33]).toEqual({ fecha: '2026-10-31', delMes: true });
    expect(celdas[41]).toEqual({ fecha: '2026-11-08', delMes: false });
    expect(celdas.filter((c) => c.delMes)).toHaveLength(31);
  });
  it('un mes que arranca en lunes no lleva días ajenos al principio', () => {
    expect((celdasDeMes('2026-06') ?? [])[0]).toEqual({ fecha: '2026-06-01', delMes: true });
  });
  it('cruza el año hacia atrás y hacia adelante', () => {
    expect((celdasDeMes('2027-01') ?? [])[0].fecha).toBe('2026-12-28');
    expect((celdasDeMes('2026-12') ?? [])[41].fecha).toBe('2027-01-10');
  });
  it('en el primer mes válido los días previos existen igual', () => {
    expect((celdasDeMes('2000-01') ?? [])[0]).toEqual({ fecha: '1999-12-27', delMes: false });
  });
  it('entrada inválida -> null', () => {
    expect(celdasDeMes('x')).toBeNull();
  });
});

describe('etiquetaDeDia', () => {
  it('día y mes en el idioma pedido', () => {
    expect(etiquetaDeDia('2026-10-14', 'es')).toBe('14 de octubre');
    expect(etiquetaDeDia('2026-10-14', 'pt-BR')).toBe('14 de outubro');
  });
});

describe('inicialesDeSemana', () => {
  it('siete iniciales, de lunes a domingo', () => {
    const letras = inicialesDeSemana('es');
    expect(letras).toHaveLength(7);
    expect(letras[0].toUpperCase()).toBe('L');
    expect(letras[6].toUpperCase()).toBe('D');
  });
});
