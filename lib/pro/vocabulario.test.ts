import { describe, expect, expectTypeOf, it } from 'vitest';
import { es, loadMessages } from '@/messages';
import esProfesionales from '@/messages/es/profesionales.json';
import ptProfesionales from '@/messages/pt-BR/profesionales.json';
import type { ProError } from './errores';

// Catálogo `profesionales` (G3 / SH-4): vocabulario del portal (negocio, persona
// titular, promo), lenguaje neutro, loader en vez del texto "Cargando..." y un
// copy por cada tipo de error del portal. La paridad de keys y de placeholders
// ICU entre es y pt-BR la exige además `node scripts/check-messages.js`.

type Hoja = [ruta: string, texto: string];

function hojas(valor: unknown, ruta = ''): Hoja[] {
  if (typeof valor === 'string') return [[ruta, valor]];
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, hijo]) => hojas(hijo, ruta ? `${ruta}.${clave}` : clave));
  }
  return [];
}

const PROHIBIDOS: [nombre: string, patron: RegExp][] = [
  ['salón / salão', /\bsal(?:ón|on|ão|ao)\b/i],
  ['dueña / dueño / dona', /\bdue(ñ|n)[ao]s?\b|\bdona\b/i],
  ['combo', /\bcombos?\b/i],
  ['ticket', /\btickets?\b/i],
  ['"Cargando..." / "Carregando..."', /carr?e?gando\s*(\.{2,}|…)/i],
  ['clientas (lenguaje neutro: clientes)', /\bclientas\b/i],
];

function conTerminosProhibidos(catalogo: unknown): string[] {
  return hojas(catalogo).flatMap(([ruta, texto]) =>
    PROHIBIDOS.filter(([, patron]) => patron.test(texto)).map(([nombre]) => `${ruta}: ${nombre}`),
  );
}

describe('catálogo profesionales — registro', () => {
  it('el namespace `profesionales` está registrado en el catálogo es', () => {
    expect(es.profesionales).toBe(esProfesionales);
    expect(hojas(esProfesionales).length).toBeGreaterThan(0);
  });

  it('pt-BR se carga con el mismo namespace y está traducido, no copiado de es', async () => {
    const pt = await loadMessages('pt-BR');
    const textoPt = hojas(pt.profesionales).find(([ruta]) => ruta === 'PortalNoDisponible.titulo')?.[1];
    const textoEs = hojas(es.profesionales).find(([ruta]) => ruta === 'PortalNoDisponible.titulo')?.[1];

    expect(textoPt).toBeTruthy();
    expect(textoPt).not.toBe(textoEs);
  });

  it('es y pt-BR tienen exactamente las mismas keys y ningún texto vacío', () => {
    const clavesEs = hojas(esProfesionales).map(([ruta]) => ruta).sort();
    const clavesPt = hojas(ptProfesionales).map(([ruta]) => ruta).sort();

    expect(clavesPt).toEqual(clavesEs);
    for (const [ruta, texto] of [...hojas(esProfesionales), ...hojas(ptProfesionales)]) {
      expect(texto.trim(), ruta).not.toBe('');
    }
  });
});

// Si se agrega un tipo de error a ProError, `tsc` falla acá hasta que se
// agregue a esta lista, y el test siguiente exige su copy en los dos idiomas.
const TIPOS_DE_ERROR = [
  'invalidCredentials',
  'sessionRevoked',
  'mustChangePassword',
  'changeNotRequired',
  'vinculoRequired',
  'vinculoDisabled',
  'noService',
  'notFound',
  'portalUnavailable',
  'rateLimited',
  'validation',
  'network',
  'server',
] as const satisfies readonly ProError['kind'][];

describe('catálogo profesionales — errores', () => {
  it('la lista cubre todos los tipos de ProError', () => {
    expectTypeOf<Exclude<ProError['kind'], (typeof TIPOS_DE_ERROR)[number]>>().toEqualTypeOf<never>();
    expect(new Set(TIPOS_DE_ERROR).size).toBe(TIPOS_DE_ERROR.length);
  });

  it.each([
    ['es', esProfesionales],
    ['pt-BR', ptProfesionales],
  ])('%s tiene un texto en Errores.* por cada tipo de error', (_idioma, catalogo) => {
    const claves = new Set(hojas(catalogo).map(([ruta]) => ruta));
    const faltantes = TIPOS_DE_ERROR.filter((tipo) => !claves.has(`Errores.${tipo}`));
    expect(faltantes).toEqual([]);
  });

  it('el aviso de espera con segundos recibe {segundos} en los dos idiomas', () => {
    for (const catalogo of [esProfesionales, ptProfesionales]) {
      const texto = hojas(catalogo).find(([ruta]) => ruta === 'Errores.rateLimitedSegundos')?.[1];
      expect(texto).toContain('{segundos}');
    }
  });
});

describe('catálogo profesionales — vocabulario', () => {
  it('es no usa términos prohibidos', () => {
    expect(conTerminosProhibidos(esProfesionales)).toEqual([]);
  });

  it('pt-BR no usa términos prohibidos', () => {
    expect(conTerminosProhibidos(ptProfesionales)).toEqual([]);
  });

  it('el escáner detecta cada término prohibido (si no, los dos tests de arriba no probarían nada)', () => {
    const malos = {
      a: 'Tu salón no tiene turnos',
      b: 'Hola dueña',
      c: 'Armá un combo',
      d: 'Ticket promedio',
      e: 'Cargando...',
      f: 'Cargando…',
      g: 'Nuestras clientas',
      h: 'Seu salão',
    };
    const detectados = conTerminosProhibidos(malos).map((linea) => linea.split(':')[0]);
    expect(detectados.sort()).toEqual(Object.keys(malos));
  });

  it('el escáner no marca el vocabulario correcto (negocio, persona titular, promo, clientes)', () => {
    const buenos = {
      a: 'Consultá con la persona titular del negocio',
      b: 'Promo de otoño',
      c: 'Tus clientes de hoy',
      d: 'Un momento',
    };
    expect(conTerminosProhibidos(buenos)).toEqual([]);
  });
});
