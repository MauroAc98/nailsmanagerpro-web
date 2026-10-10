import { describe, expect, it } from 'vitest';
import { diasDesde, esNegocioActivo, formatFechaHora, formatUltimoTurno, textoDias } from './usoFechas';

// Buenos Aires = UTC-3, sin horario de verano.
const ba = (iso: string) => Math.floor(new Date(`${iso}-03:00`).getTime() / 1000);

describe('diasDesde', () => {
  const ahora = ba('2026-10-09T10:00:00');

  it('devuelve null si nunca hubo un turno', () => {
    expect(diasDesde(null, ahora)).toBeNull();
  });

  it('hoy es 0', () => {
    expect(diasDesde(ba('2026-10-09T00:05:00'), ahora)).toBe(0);
  });

  it('ayer es 1, aunque hayan pasado menos de 24 horas', () => {
    expect(diasDesde(ba('2026-10-08T23:50:00'), ahora)).toBe(1);
  });

  it('cuenta días calendario en Buenos Aires, no en UTC', () => {
    // 23:30 en Buenos Aires del 8 de oct ya es 9 de oct en UTC (02:30Z).
    const turno = ba('2026-10-08T23:30:00');
    expect(new Date(turno * 1000).getUTCDate()).toBe(9);
    // Ahora: 00:10 del 9 en Buenos Aires (03:10Z del 9).
    expect(diasDesde(turno, ba('2026-10-09T00:10:00'))).toBe(1);
  });

  it('21 días atrás', () => {
    expect(diasDesde(ba('2026-09-18T16:45:00'), ahora)).toBe(21);
  });

  it('un turno futuro no da negativo', () => {
    expect(diasDesde(ba('2026-10-12T10:00:00'), ahora)).toBe(0);
  });
});

describe('formatUltimoTurno', () => {
  it('formatea día, mes corto y hora 24h en Buenos Aires', () => {
    expect(formatUltimoTurno(ba('2026-09-18T16:45:00'))).toBe('18 sep, 16:45 hs');
    expect(formatUltimoTurno(ba('2026-10-06T09:05:00'))).toBe('6 oct, 09:05 hs');
  });

  it('usa la hora de Buenos Aires aunque el epoch caiga al día siguiente en UTC', () => {
    expect(formatUltimoTurno(ba('2026-09-30T23:10:00'))).toBe('30 sep, 23:10 hs');
  });
});

describe('formatFechaHora', () => {
  it('separa fecha dd/mm/aaaa y hora hh:mm', () => {
    expect(formatFechaHora(ba('2026-09-19T09:03:00'))).toEqual({ fecha: '19/09/2026', hora: '09:03' });
  });
});

describe('textoDias', () => {
  it('"Hoy" para 0, "—" para null, número y unidad en el resto', () => {
    expect(textoDias(0)).toEqual({ numero: 'Hoy', unidad: '' });
    expect(textoDias(null)).toEqual({ numero: '—', unidad: '' });
    expect(textoDias(1)).toEqual({ numero: '1', unidad: 'día' });
    expect(textoDias(21)).toEqual({ numero: '21', unidad: 'días' });
  });
});

describe('esNegocioActivo', () => {
  it('inactivo si nunca agendó o pasaron más de 14 días', () => {
    expect(esNegocioActivo(null)).toBe(false);
    expect(esNegocioActivo(15)).toBe(false);
  });
  it('activo hasta 14 días inclusive', () => {
    expect(esNegocioActivo(14)).toBe(true);
    expect(esNegocioActivo(0)).toBe(true);
  });
});
