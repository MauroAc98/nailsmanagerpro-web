import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compararFechaHora,
  diasEntre,
  diaDe,
  esFechaValida,
  horaDe,
  hora12,
  horaFin,
  partirFechaHora,
  rangoPermitido,
} from './fechaHora';

// `fecha_hora` del portal es hora de pared SIN sufijo de zona. Todo acá es
// aritmética de strings/números: estos tests corren con TZ=UTC y con
// TZ=America/Argentina/Buenos_Aires, y además se reemplaza `Date` por una clase
// que tira para probar que ninguna función la usa.
afterEach(() => {
  vi.unstubAllGlobals();
});

function prohibirDate() {
  vi.stubGlobal(
    'Date',
    class {
      constructor() {
        throw new Error('Date no debe usarse sobre la hora de pared');
      }
      static now(): number {
        throw new Error('Date.now no debe usarse');
      }
      static parse(): number {
        throw new Error('Date.parse no debe usarse');
      }
      static UTC(): number {
        throw new Error('Date.UTC no debe usarse');
      }
    },
  );
}

describe('partirFechaHora', () => {
  it('separa día y hora sin tocar la zona', () => {
    prohibirDate();
    expect(partirFechaHora('2026-10-17T09:30:00')).toEqual({ fecha: '2026-10-17', hora: '09:30' });
    expect(partirFechaHora('2026-12-31T23:59:59')).toEqual({ fecha: '2026-12-31', hora: '23:59' });
  });

  it('acepta el formato sin segundos', () => {
    expect(partirFechaHora('2026-10-17T09:30')).toEqual({ fecha: '2026-10-17', hora: '09:30' });
  });

  it.each([
    ['con sufijo de zona Z', '2026-10-17T09:30:00Z'],
    ['con offset', '2026-10-17T09:30:00-03:00'],
    ['con milisegundos', '2026-10-17T09:30:00.000'],
    ['con espacio en vez de T', '2026-10-17 09:30:00'],
    ['hora 24', '2026-10-17T24:00:00'],
    ['minuto 60', '2026-10-17T09:60:00'],
    ['segundo 60', '2026-10-17T09:30:60'],
    ['mes 13', '2026-13-01T09:30:00'],
    ['31 de febrero', '2026-02-31T09:30:00'],
    ['29 de febrero de un año no bisiesto', '2027-02-29T09:30:00'],
    ['texto', 'mañana a la tarde'],
    ['vacío', ''],
    ['con basura al final', '2026-10-17T09:30:00 DROP'],
  ])('rechaza %s', (_nombre, valor) => {
    expect(partirFechaHora(valor)).toBeNull();
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(partirFechaHora('2028-02-29T00:00:00')).toEqual({ fecha: '2028-02-29', hora: '00:00' });
  });

  it('rechaza valores que no son string', () => {
    expect(partirFechaHora(null as unknown as string)).toBeNull();
    expect(partirFechaHora(20261017 as unknown as string)).toBeNull();
  });
});

describe('diaDe / horaDe', () => {
  it('devuelven la clave de día y la hora de pared', () => {
    prohibirDate();
    expect(diaDe('2026-10-17T09:30:00')).toBe('2026-10-17');
    expect(horaDe('2026-10-17T09:30:00')).toBe('09:30');
    expect(horaDe('2026-10-17T00:05:00')).toBe('00:05');
  });

  it('devuelven null con un valor inválido', () => {
    expect(diaDe('nope')).toBeNull();
    expect(horaDe('nope')).toBeNull();
  });
});

describe('compararFechaHora', () => {
  it('ordena por día y luego por hora', () => {
    prohibirDate();
    const lista = ['2026-10-18T08:00:00', '2026-10-17T15:00:00', '2026-10-17T09:30:00'];
    expect([...lista].sort(compararFechaHora)).toEqual([
      '2026-10-17T09:30:00',
      '2026-10-17T15:00:00',
      '2026-10-18T08:00:00',
    ]);
  });

  it('trata igual el formato con y sin segundos', () => {
    expect(compararFechaHora('2026-10-17T09:30', '2026-10-17T09:30:00')).toBe(0);
    expect(compararFechaHora('2026-10-17T09:30', '2026-10-17T09:30:15')).toBeLessThan(0);
  });

  it('un valor inválido va al final y no rompe el orden', () => {
    const lista = ['basura', '2026-10-17T09:30:00', '2026-10-16T09:30:00'];
    expect([...lista].sort(compararFechaHora)).toEqual(['2026-10-16T09:30:00', '2026-10-17T09:30:00', 'basura']);
  });
});

describe('horaFin', () => {
  it('suma la duración a la hora de pared', () => {
    prohibirDate();
    expect(horaFin('09:30', 90)).toEqual({ hora: '11:00', diaSiguiente: false });
    expect(horaFin('09:30', 0)).toEqual({ hora: '09:30', diaSiguiente: false });
  });

  it('marca diaSiguiente al cruzar la medianoche', () => {
    expect(horaFin('23:30', 60)).toEqual({ hora: '00:30', diaSiguiente: true });
    expect(horaFin('23:59', 1)).toEqual({ hora: '00:00', diaSiguiente: true });
  });

  it('terminar justo a las 24:00 es el día siguiente a las 00:00', () => {
    expect(horaFin('22:00', 120)).toEqual({ hora: '00:00', diaSiguiente: true });
    expect(horaFin('22:00', 119)).toEqual({ hora: '23:59', diaSiguiente: false });
  });

  it('una duración de más de un día sigue siendo día siguiente', () => {
    expect(horaFin('10:00', 1500)).toEqual({ hora: '11:00', diaSiguiente: true });
  });

  it('devuelve null con hora o duración inválidas', () => {
    expect(horaFin('25:00', 30)).toBeNull();
    expect(horaFin('9:30', 30)).toBeNull();
    expect(horaFin('09:30', -5)).toBeNull();
    expect(horaFin('09:30', Number.NaN)).toBeNull();
    expect(horaFin('09:30', 1.5)).toBeNull();
  });
});

describe('esFechaValida / diasEntre', () => {
  it('valida la fecha de calendario', () => {
    expect(esFechaValida('2028-02-29')).toBe(true);
    expect(esFechaValida('2027-02-29')).toBe(false);
    expect(esFechaValida('2026-04-31')).toBe(false);
    expect(esFechaValida('2026-4-1')).toBe(false);
    expect(esFechaValida('2026-10-17T09:30:00')).toBe(false);
  });

  it('cuenta días dentro del mismo mes', () => {
    prohibirDate();
    expect(diasEntre('2026-10-17', '2026-10-17')).toBe(0);
    expect(diasEntre('2026-10-17', '2026-10-20')).toBe(3);
  });

  it('cruza el año bisiesto', () => {
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    expect(diasEntre('2027-02-28', '2027-03-01')).toBe(1);
    expect(diasEntre('2028-01-01', '2029-01-01')).toBe(366);
    expect(diasEntre('2027-01-01', '2028-01-01')).toBe(365);
  });

  it('cruza de diciembre a enero', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2026-12-25', '2027-01-05')).toBe(11);
  });

  it('es negativo si hasta es anterior a desde', () => {
    expect(diasEntre('2026-10-20', '2026-10-17')).toBe(-3);
  });

  it('devuelve null si alguna fecha es inválida', () => {
    expect(diasEntre('2026-02-30', '2026-03-01')).toBeNull();
    expect(diasEntre('2026-03-01', 'basura')).toBeNull();
  });
});

// Regla del backend (ListarTurnosProfesionalRequest): desde/hasta >= 2000-01-01,
// hasta >= desde y el rango no supera 366 días CONTANDO ambos extremos, o sea
// diasEntre(desde, hasta) <= 365.
describe('rangoPermitido (regla de 366 días del backend)', () => {
  it('acepta un solo día y un rango corto', () => {
    prohibirDate();
    expect(rangoPermitido('2026-10-17', '2026-10-17')).toBe(true);
    expect(rangoPermitido('2026-10-01', '2026-10-31')).toBe(true);
  });

  it('el límite son 366 días contando ambos extremos (365 de diferencia)', () => {
    expect(rangoPermitido('2026-01-01', '2026-12-31')).toBe(true); // 365 días en total
    expect(rangoPermitido('2026-01-01', '2027-01-01')).toBe(true); // 366 días en total
    expect(rangoPermitido('2026-01-01', '2027-01-02')).toBe(false); // 367
  });

  it('en año bisiesto el año completo cabe y un día más no', () => {
    expect(rangoPermitido('2028-01-01', '2028-12-31')).toBe(true); // 366 días en total
    expect(rangoPermitido('2028-01-01', '2029-01-01')).toBe(false); // 367
  });

  it('rechaza hasta anterior a desde', () => {
    expect(rangoPermitido('2026-10-17', '2026-10-16')).toBe(false);
  });

  it('el mínimo es 2000-01-01 para ambos extremos', () => {
    expect(rangoPermitido('2000-01-01', '2000-01-31')).toBe(true);
    expect(rangoPermitido('1999-12-31', '2000-01-31')).toBe(false);
    expect(rangoPermitido('1999-12-01', '1999-12-31')).toBe(false);
  });

  it('rechaza fechas inexistentes o con otro formato', () => {
    expect(rangoPermitido('2026-02-30', '2026-03-05')).toBe(false);
    expect(rangoPermitido('2026-10-01', 'basura')).toBe(false);
    expect(rangoPermitido('2026-10-01', '2026-10-17T09:30:00')).toBe(false);
  });
});

// Ban estático de `Date` en la lógica de hora de pared (comentarios excluidos).
const RAIZ = path.resolve(__dirname, '..', '..');

// Quita comentarios de bloque y de línea. El `(?<![:\\])` evita cortar en
// "https://" o en el `\//` final de un regex literal.
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:\\])\/\/.*$/gm, '');
}

const USA_DATE = /\bDate\b/;

describe('ban estático de Date en la hora de pared', () => {
  it('el detector ignora comentarios y detecta código', () => {
    expect(USA_DATE.test(sinComentarios('// usa new Date aquí\nconst a = 1;'))).toBe(false);
    expect(USA_DATE.test(sinComentarios('/* Date.parse */ const a = 1;'))).toBe(false);
    expect(USA_DATE.test(sinComentarios("const url = 'https://x.y'; // Date"))).toBe(false);
    expect(USA_DATE.test(sinComentarios('const d = new Date(fecha);'))).toBe(true);
    expect(USA_DATE.test(sinComentarios('const t = Date.parse(fecha);'))).toBe(true);
    expect(USA_DATE.test(sinComentarios("const u = 'https://x.y'; const t = Date.now();"))).toBe(true);
    expect(USA_DATE.test(sinComentarios('const fechaDate = 1; const fechaHora = 2;'))).toBe(false);
  });

  it.each(['lib/pro/fechaHora.ts', 'lib/pro/parsers.ts'])('%s no usa Date', (archivo) => {
    const fuente = readFileSync(path.join(RAIZ, archivo), 'utf8');
    expect(fuente.length).toBeGreaterThan(500);
    expect(sinComentarios(fuente).match(USA_DATE)).toBeNull();
  });
});

describe('hora12', () => {
  it('formatea como la pantalla de editar turno', () => {
    expect(hora12('00:05')).toBe('12:05 a. m. hs');
    expect(hora12('09:30')).toBe('9:30 a. m. hs');
    expect(hora12('12:00')).toBe('12:00 p. m. hs');
    expect(hora12('23:59')).toBe('11:59 p. m. hs');
  });

  it('devuelve null ante una hora inválida', () => {
    expect(hora12('24:00')).toBeNull();
    expect(hora12('9:30')).toBeNull();
    expect(hora12('')).toBeNull();
  });
});
