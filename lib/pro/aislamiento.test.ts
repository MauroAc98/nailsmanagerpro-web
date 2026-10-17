import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Aislamiento del portal de profesionales (G2, AG-1 S4-S5): escaneo estático de
// los módulos del portal con una LISTA PERMITIDA. El código del portal solo
// puede importar lo que está enumerado acá; cualquier otra cosa (la instancia
// axios, los stores, los servicios, los helpers de WhatsApp o las cards del
// tenant, pero también cualquier módulo que hoy no existe) falla. Agregar un
// módulo compartido al portal exige tocar esta lista, o sea, una revisión
// explícita de que no arrastra token, eventos ni datos sensibles (teléfono,
// precio).
//
// También falla ante un `import()`/`require()` cuyo argumento no sea un literal
// (no se puede saber qué carga) y ante enlaces de contacto (tel:, wa.me...).
//
// Escanea código de producción, no los *.test.* (un test que compare contra el
// tenant, como proApi.test.ts, no llega al bundle). Los directorios que todavía
// no existen se ignoran y empiezan a escanearse solos cuando aparecen.

const RAIZ = path.resolve(__dirname, '..', '..');

// ── Qué módulos son "del portal" ─────────────────────────────────────────────

const EXTENSION = /\.(tsx?|jsx?|mjs|cjs)$/;
const ES_TEST = /\.(test|spec)\.(tsx?|jsx?|mjs|cjs)$/;

const PATRONES_DEL_PORTAL: RegExp[] = [
  /^lib\/pro\//, // lib/pro/**
  /^lib\/pro[A-Z][^/]*$/, // lib/proApi.ts y similares (no lib/promoEstadoOnline.ts)
  /^services\/proService[^/]*$/,
  /^hooks\/pro\//, // hooks/pro/**
  /^hooks\/(usePro[A-Z]|useRutaPro)[^/]*$/, // no hooks/useProfesional*
  /^store\/(.+\/)?usePro[A-Z][^/]*$/, // en cualquier subcarpeta de store (no useProfesionalStore)
  /^components\/pro\//,
  /^app\/\(profesionales\)\//,
];

function esDelPortal(ruta: string): boolean {
  return EXTENSION.test(ruta) && !ES_TEST.test(ruta) && PATRONES_DEL_PORTAL.some((patron) => patron.test(ruta));
}

// Se listan completos solo los árboles donde puede vivir código del portal.
const RAICES_A_LISTAR = ['lib', 'hooks', 'services', 'store', 'components/pro', 'app/(profesionales)'];

function listar(dirRelativo: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(path.join(RAIZ, dirRelativo));
  } catch {
    return [];
  }
  return entradas.flatMap((nombre) => {
    const relativo = `${dirRelativo}/${nombre}`;
    return statSync(path.join(RAIZ, relativo)).isDirectory() ? listar(relativo) : [relativo];
  });
}

function modulosDelPortal(): string[] {
  return RAICES_A_LISTAR.flatMap(listar).filter(esDelPortal).sort();
}

// ── Qué puede importar el portal ─────────────────────────────────────────────

// Rutas del proyecto (relativas a la raíz, sin extensión ni /index).
const PROYECTO_PERMITIDO: RegExp[] = [
  /^lib\/pro(\/.+)?$/,
  /^lib\/pro[A-Z][^/]*$/, // lib/proApi
  /^lib\/hosts$/, // normalización de hosts (pura)
  /^services\/proService$/,
  /^store\/(.+\/)?usePro[A-Z][^/]*$/,
  /^hooks\/pro(\/.+)?$/,
  /^hooks\/(useRutaPro|usePro[A-Z][^/]*)$/,
  /^components\/pro(\/.+)?$/,
  /^app\/\(profesionales\)(\/.+)?$/,
  // Módulos compartidos revisados: se agregan ACÁ, uno por uno, junto con el
  // slice que los necesita (WeekStrip, BottomSheet...). Cada uno se revisó para
  // confirmar que no arrastra token, eventos ni datos del salón:
  /^components\/Spinner$/, // presentacional; solo importa theme/agendaColors y theme/colors
  /^components\/AgendaThemeScope$/, // aplica la clase de tema; solo importa store/useThemeStore (preferencia de tema)
  /^store\/useLocaleStore$/, // el portal solo lee `mensajesListos`; no importa nada de sesión ni de datos del salón
  /^store\/useThemeStore$/, // preferencia de tema claro/oscuro (setTheme y resolvedTheme); sin sesión ni datos del negocio
  /^theme\/agendaColors$/, // constantes de paleta (variables CSS)
  /^components\/filtros\/AvatarProfesional$/, // presentacional (foto o iniciales); solo importa theme/* y lib/inicialesProfesional
  /^components\/BottomSheet$/, // sheet de arrastre; solo importa react y theme/colors, sin sesión ni datos
  /^lib\/duracion$/, // formato de minutos a "1 h 30"; función pura, sin imports
  /^lib\/cacheLru$/, // LRU genérico con vigencia; sin imports ni estado global (cada instancia es propia)
  // WeekStrip es presentacional (todo entra por props). Sus imports transitivos se
  // revisaron: lib/dateFormat (solo useLocaleStore), agendaDateHelpers, theme/*,
  // lucide-react y un TIPO de services/turnoService; sin stores de sesión, token,
  // teléfono ni precio.
  /^components\/agenda\/WeekStrip$/,
  /^components\/filtros\/ServiciosSheetBase$/, // hoja y lista de servicios presentacionales (todo por props); solo importan react, BottomSheet y theme/agendaColors
  /^constants\/layout$/, // constantes numéricas del nav (NAV_CLEARANCE); sin imports
  /^components\/Skeleton$/, // barra gris presentacional (props de tamaño); solo importa react (tipos) y theme/agendaColors
];

const PAQUETES_PERMITIDOS = new Set([
  'react',
  'react-dom',
  'next',
  'next-intl',
  'axios',
  'zustand',
  'vitest',
  '@testing-library/react',
  '@testing-library/dom',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
]);

const BUILTINS = new Set(builtinModules);

// ── Escáner (se prueba aparte más abajo) ─────────────────────────────────────

// Quita comentarios de línea y de bloque sin tocar el contenido de los strings
// ('http://x' no es un comentario), para que `import(/* x */ 'y')` y los
// imports comentados se lean bien.
function sinComentarios(fuente: string): string {
  let salida = '';
  let i = 0;
  while (i < fuente.length) {
    const c = fuente[i];
    const siguiente = fuente[i + 1];
    if (c === '/' && siguiente === '/') {
      while (i < fuente.length && fuente[i] !== '\n') i += 1;
      salida += ' ';
    } else if (c === '/' && siguiente === '*') {
      const fin = fuente.indexOf('*/', i + 2);
      i = fin === -1 ? fuente.length : fin + 2;
      salida += ' ';
    } else if (c === "'" || c === '"' || c === '`') {
      salida += c;
      i += 1;
      while (i < fuente.length && fuente[i] !== c) {
        if (fuente[i] === '\\' && i + 1 < fuente.length) {
          salida += fuente[i];
          i += 1;
        }
        salida += fuente[i];
        i += 1;
      }
      if (i < fuente.length) {
        salida += c;
        i += 1;
      }
    } else {
      salida += c;
      i += 1;
    }
  }
  return salida;
}

interface Importaciones {
  literales: string[];
  // Llamadas import()/require() cuyo argumento no es un literal: no se sabe qué cargan.
  noLiterales: string[];
}

const DESDE = /\bfrom\s*(['"])((?:(?!\1).)*)\1/g; // import ... from 'x' / export ... from 'x'
const EFECTO = /\bimport\s*(['"])((?:(?!\1).)*)\1/g; // import 'x'
const LLAMADA = /\b(?:import|require|importActual|requireActual|importOriginal)\s*\(\s*/g; // import('x') / require('x')

function importacionesDe(fuente: string): Importaciones {
  const codigo = sinComentarios(fuente);
  const literales: string[] = [];
  const noLiterales: string[] = [];

  for (const m of codigo.matchAll(DESDE)) literales.push(m[2]);
  for (const m of codigo.matchAll(EFECTO)) literales.push(m[2]);

  for (const m of codigo.matchAll(LLAMADA)) {
    const resto = codigo.slice((m.index ?? 0) + m[0].length);
    const comilla = resto[0];
    if (comilla === "'" || comilla === '"' || comilla === '`') {
      const fin = resto.indexOf(comilla, 1);
      const contenido = fin === -1 ? '' : resto.slice(1, fin);
      const despues = fin === -1 ? '' : resto.slice(fin + 1).trimStart()[0];
      // Un literal solo cuenta si es TODO el argumento: `'a' + b` o `${x}` no.
      const esLiteral = fin !== -1 && !contenido.includes('${') && (despues === ')' || despues === ',');
      if (esLiteral) {
        literales.push(contenido);
        continue;
      }
    }
    noLiterales.push(`${m[0].trim()}${resto.slice(0, 30).split('\n')[0]}`);
  }
  return { literales, noLiterales };
}

type Resolucion = { tipo: 'proyecto'; ruta: string } | { tipo: 'paquete'; nombre: string } | { tipo: 'invalido' };

function resolver(especificador: string, archivo: string): Resolucion {
  if (especificador === '' || /[\\\0]/.test(especificador)) return { tipo: 'invalido' };

  let ruta: string | null = null;
  if (especificador.startsWith('@/')) ruta = especificador.slice(2);
  else if (especificador.startsWith('.')) ruta = path.posix.join(path.posix.dirname(archivo), especificador);

  if (ruta !== null) {
    const normalizada = path.posix.normalize(ruta);
    // Fuera de la raíz del proyecto (../../..) o ruta absoluta: no se acepta.
    if (normalizada === '..' || normalizada.startsWith('../') || normalizada.startsWith('/')) return { tipo: 'invalido' };
    return {
      tipo: 'proyecto',
      ruta: normalizada.replace(EXTENSION, '').replace(/\/index$/, '').replace(/\/$/, ''),
    };
  }

  if (especificador.startsWith('node:')) return { tipo: 'paquete', nombre: especificador };
  // '/abs', 'http://...', 'file:...' y cualquier otro esquema.
  if (especificador.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(especificador)) return { tipo: 'invalido' };

  const partes = especificador.split('/');
  return { tipo: 'paquete', nombre: especificador.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0] };
}

function estaPermitido(resolucion: Resolucion): boolean {
  if (resolucion.tipo === 'invalido') return false;
  if (resolucion.tipo === 'proyecto') return PROYECTO_PERMITIDO.some((patron) => patron.test(resolucion.ruta));
  return (
    resolucion.nombre.startsWith('node:') || BUILTINS.has(resolucion.nombre) || PAQUETES_PERMITIDOS.has(resolucion.nombre)
  );
}

function infraccionesDeImports(archivo: string, fuente: string): string[] {
  const { literales, noLiterales } = importacionesDe(fuente);
  return [
    ...literales
      .filter((especificador) => !estaPermitido(resolver(especificador, archivo)))
      .map((especificador) => `${archivo} importa "${especificador}" (fuera de la lista permitida)`),
    ...noLiterales.map((llamada) => `${archivo} tiene un import dinámico que no es un literal: ${llamada}`),
  ];
}

// Enlaces de contacto (AG-1 S5). `(^|[^a-z])` evita falsos positivos tipo "hotel:".
const ENLACE_DE_CONTACTO = /(^|[^a-z])(tel|sms|mailto|whatsapp):|\bwa\.me\b|\bapi\.whatsapp\.com\b/i;

// ── Escaneo real ─────────────────────────────────────────────────────────────

describe('aislamiento del portal — escaneo de módulos reales', () => {
  const modulos = modulosDelPortal();

  it('el escaneo ve los módulos del portal (no es vacío)', () => {
    expect(modulos).toEqual(
      expect.arrayContaining([
        'lib/proApi.ts',
        'lib/pro/errores.ts',
        'lib/pro/parsers.ts',
        'lib/pro/tipos.ts',
        'lib/pro/fechaHora.ts',
        'services/proService.ts',
        'hooks/useRutaPro.ts',
        'lib/pro/acceso.ts',
        'lib/pro/resolveProRoute.ts',
        'store/useProAuthStore.ts',
        'components/pro/ProGuard.tsx',
        'components/pro/PortalNoDisponible.tsx',
        'app/(profesionales)/pro/layout.tsx',
        'app/(profesionales)/pro/page.tsx',
        'app/(profesionales)/pro/no-disponible/page.tsx',
      ]),
    );
    expect(modulos.some((m) => ES_TEST.test(m))).toBe(false);
  });

  it('ningún módulo del portal importa nada fuera de la lista permitida', () => {
    const infracciones = modulos.flatMap((archivo) =>
      infraccionesDeImports(archivo, readFileSync(path.join(RAIZ, archivo), 'utf8')),
    );
    expect(infracciones).toEqual([]);
  });

  it('ningún módulo del portal contiene un enlace tel:, sms:, mailto:, whatsapp: ni wa.me', () => {
    const infracciones = modulos.filter((archivo) => ENLACE_DE_CONTACTO.test(readFileSync(path.join(RAIZ, archivo), 'utf8')));
    expect(infracciones).toEqual([]);
  });
});

// ── Qué archivos entran al escaneo ───────────────────────────────────────────

describe('aislamiento del portal — selección de archivos', () => {
  it.each([
    'lib/pro/errores.ts',
    'lib/pro/sub/dir/x.tsx',
    'lib/proApi.ts',
    'lib/proApi.mjs',
    'lib/proAlgo.js',
    'services/proService.ts',
    'hooks/pro/useProRecurso.ts',
    'hooks/useRutaPro.ts',
    'hooks/useProTurnos.ts',
    'store/useProAuthStore.ts',
    'store/anidado/profundo/useProAgendaStore.tsx',
    'components/pro/ProTurnoCard.tsx',
    'components/pro/sub/Algo.jsx',
    'app/(profesionales)/pro/login/page.tsx',
    'app/(profesionales)/pro/layout.mjs',
  ])('%s se escanea', (ruta) => {
    expect(esDelPortal(ruta)).toBe(true);
  });

  it.each([
    'lib/api.ts',
    'lib/promoEstadoOnline.ts', // empieza con "pro" pero no es del portal
    'lib/proveedor.ts',
    'hooks/useProfesionales.ts',
    'store/useProfesionalStore.ts',
    'store/anidado/useProfesionalStore.ts',
    'services/turnoService.ts',
    'components/Spinner.tsx',
    'lib/pro/errores.test.ts', // los tests no se escanean
    'components/pro/Algo.spec.tsx',
    'lib/pro/notas.md',
    'lib/pro/estilos.css',
  ])('%s no se escanea', (ruta) => {
    expect(esDelPortal(ruta)).toBe(false);
  });
});

// ── El escáner detecta (si no, el escaneo de arriba no probaría nada) ────────

describe('aislamiento del portal — el escáner', () => {
  const ARCHIVO = 'lib/pro/x.ts';
  const infracciones = (fuente: string, archivo = ARCHIVO) => infraccionesDeImports(archivo, fuente);

  describe('detecta cada forma de importar código ajeno', () => {
    it.each([
      ['import estático', "import api from '@/lib/api';"],
      ['import de tipo', "import type { Turno } from '@/services/turnoService';"],
      ['import con llaves en varias líneas', "import {\n  a,\n  b,\n} from '@/store/useAuthStore';"],
      ['import por efecto', "import '@/lib/api';"],
      ['import por efecto con comillas dobles', 'import "@/lib/api";'],
      ['export ... from', "export { api } from '@/lib/api';"],
      ['export * from', "export * from '@/lib/whatsappHelper';"],
      ['import dinámico', "const m = await import('@/lib/api');"],
      ['import dinámico con comentario de bloque entre ( y la comilla', "const m = import(/* webpackChunkName: 'x' */ '@/lib/api');"],
      ['import dinámico con comentario de línea entre ( y la comilla', "const m = import( // truco\n  '@/lib/api');"],
      ['import dinámico con comentarios y saltos de línea', "const m = import(\n  /* uno */\n  /* dos */\n  \"@/lib/api\"\n);"],
      ['import dinámico con template literal sin interpolación', 'const m = import(`@/lib/api`);'],
      ['require', "const api = require('../api');"],
      ['require con comentario', "const api = require(/* x */ '@/lib/api');"],
      ['import = require', "import api = require('@/lib/api');"],
      ['vi.importActual', "const m = await vi.importActual('@/lib/api');"],
      ['tipo import()', "type A = typeof import('@/lib/api');"],
      ['después de un string con //', "const u = 'http://x.y'; const m = import('@/lib/api');"],
      ['después de un string con /*', "const u = '/* no es comentario'; const m = import('@/lib/api'); const v = '*/';"],
    ])('%s', (_nombre, fuente) => {
      const hallazgos = infracciones(fuente);
      expect(hallazgos.length).toBeGreaterThan(0);
      expect(hallazgos.join('\n')).toMatch(/fuera de la lista permitida/);
    });
  });

  describe('falla cerrado ante un import dinámico que no es un literal', () => {
    it.each([
      ['variable en import()', 'const m = await import(ruta);'],
      ['variable en require()', 'const m = require(nombre);'],
      ['concatenación', "const m = await import('@/lib/' + 'api');"],
      ['template literal con interpolación', 'const m = await import(`@/lib/${nombre}`);'],
      ['llamada a función', "const m = await import(armarRuta('api'));"],
      ['literal seguido de otra expresión', "const m = require('@/lib/pro/errores' + extra);"],
      ['vi.importActual con variable', 'const m = await vi.importActual(ruta);'],
    ])('%s', (_nombre, fuente) => {
      expect(infracciones(fuente).join('\n')).toMatch(/import dinámico que no es un literal/);
    });
  });

  describe('normaliza rutas relativas y con @/ antes de decidir', () => {
    it.each([
      ['relativa con ..', "import a from '../api';", ARCHIVO],
      ['relativa que sube y baja', "import a from '../pro/../api';", ARCHIVO],
      ['con ./ intermedio', "import a from './.././api';", ARCHIVO],
      ['@/ con .. interno', "import a from '@/lib/pro/../api';", ARCHIVO],
      ['@/ con ./ interno', "import a from '@/lib/./api';", ARCHIVO],
      ['@/ con barras dobles', "import a from '@/lib//api';", ARCHIVO],
      ['con extensión', "import a from '@/lib/api.ts';", ARCHIVO],
      ['con /index', "import a from '@/store/useAuthStore/index';", ARCHIVO],
      ['desde un componente del portal', "import a from '../../services/turnoService';", 'components/pro/Algo.tsx'],
      ['desde una página del portal', "import a from '../../../../lib/api';", 'app/(profesionales)/pro/login/page.tsx'],
    ])('%s', (_nombre, fuente, archivo) => {
      expect(infracciones(fuente, archivo).length).toBeGreaterThan(0);
    });

    it('rechaza rutas que salen de la raíz, absolutas, con backslash o con esquema', () => {
      for (const especificador of ['../../../etc/passwd', '/etc/passwd', '..\\api', '@/..\\api', 'file:///x', 'https://x.y/z.js', '@/../fuera']) {
        expect(infracciones(`import a from '${especificador}';`).length, especificador).toBeGreaterThan(0);
      }
    });
  });

  describe('lista permitida: todo lo que no está enumerado falla', () => {
    it.each([
      ['módulo del proyecto desconocido', "import { f } from '@/lib/dateFormat';"],
      ['componente compartido sin revisar', "import { BootSplash } from '@/components/BootSplash';"],
      ['store del tenant con nombre parecido a useLocaleStore', "import { x } from '@/store/useLocaleStoreExtra';"],
      ['Spinner con sufijo (otro módulo)', "import x from '@/components/SpinnerExtra';"],
      ['theme/colors no está habilitado directo', "import { colors } from '@/theme/colors';"],
      ['useThemeStore con sufijo (otro módulo)', "import { x } from '@/store/useThemeStoreExtra';"],
      ['store de sesión del tenant', "import { useAuthStore } from '@/store/useAuthStore';"],
      ['store del tenant', "import { useProfesionalStore } from '@/store/useProfesionalStore';"],
      ['hook del tenant', "import { x } from '@/hooks/useMarcasMesProfesional';"],
      ['paquete no enumerado', "import _ from 'lodash';"],
      ['subruta de un paquete no enumerado', "import x from 'lodash/get';"],
      ['paquete con scope no enumerado', "import x from '@sentry/nextjs';"],
      ['servicio del admin', "import { adminService } from '@/services/adminService';"],
      ['lib/proveedor (parece pro pero no lo es)', "import x from '@/lib/proveedor';"],
      ['lib/promoEstadoOnline', "import x from '@/lib/promoEstadoOnline';"],
      ['useProfesionalStore por prefijo usePro', "import x from '@/store/useProfesionalStore';"],
      ['BottomSheet con sufijo (otro módulo)', "import x from '@/components/BottomSheetExtra';"],
      ['componente con nombre parecido a BottomSheet en otra carpeta', "import x from '@/components/agenda/BottomSheet';"],
      ['AvatarProfesional con sufijo (otro módulo)', "import x from '@/components/filtros/AvatarProfesionalExtra';"],
      ['AvatarProfesional de otra carpeta (reserva online)', "import x from '@/components/reservaOnline/AvatarProfesional';"],
      ['otro componente de filtros', "import x from '@/components/filtros/FiltroProfesional';"],
      ['cacheLru con sufijo (otro módulo)', "import x from '@/lib/cacheLruExtra';"],
      ['cacheLru en otra carpeta', "import x from '@/lib/otra/cacheLru';"],
      ['WeekStrip con sufijo (otro módulo)', "import x from '@/components/agenda/WeekStripExtra';"],
      ['WeekStrip de otra carpeta', "import x from '@/components/reservaOnline/WeekStrip';"],
      ['otro componente de agenda (tarjeta del tenant)', "import x from '@/components/agenda/TurnoCard';"],
      ['constants/layout con sufijo (otro módulo)', "import x from '@/constants/layoutExtra';"],
      ['otro módulo de constants', "import x from '@/constants/precios';"],
    ])('%s', (_nombre, fuente) => {
      expect(infracciones(fuente).length).toBeGreaterThan(0);
    });

    it.each([
      ['lib/pro por @/', "import { e } from '@/lib/pro/errores';"],
      ['lib/pro por ruta relativa', "import { e } from './errores';"],
      ['lib/pro subiendo y bajando', "import { e } from '../pro/errores';"],
      ['proApi', "import proApi from '@/lib/proApi';"],
      ['proApi con extensión', "import proApi from '@/lib/proApi.ts';"],
      ['hosts', "import { normalizarHost } from '@/lib/hosts';"],
      ['proService', "import { proService } from '@/services/proService';"],
      ['store del portal', "import { useProAuthStore } from '@/store/useProAuthStore';"],
      ['store del portal en subcarpeta', "import { x } from '@/store/pro/useProAgendaStore';"],
      ['hook useRutaPro', "import { useRutaPro } from '@/hooks/useRutaPro';"],
      ['hooks/pro', "import { x } from '@/hooks/pro/useProRecurso';"],
      ['componentes del portal', "import { x } from '@/components/pro/ProGuard';"],
      ['páginas del portal', "import { x } from '@/app/(profesionales)/pro/algo';"],
      ['Spinner (compartido revisado)', "import { Spinner } from '@/components/Spinner';"],
      ['AgendaThemeScope (compartido revisado)', "import { AgendaThemeScope } from '@/components/AgendaThemeScope';"],
      ['useThemeStore (compartido revisado)', "import { setTheme, useThemeStore } from '@/store/useThemeStore';"],
      ['useLocaleStore (compartido revisado)', "import { useLocaleStore } from '@/store/useLocaleStore';"],
      ['paleta de la agenda (compartido revisado)', "import { agendaColors } from '@/theme/agendaColors';"],
      ['BottomSheet (compartido revisado)', "import { BottomSheet } from '@/components/BottomSheet';"],
      ['AvatarProfesional (compartido revisado)', "import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';"],
      ['cacheLru (compartido revisado)', "import { crearCacheLru } from '@/lib/cacheLru';"],
      ['WeekStrip (compartido revisado)', "import { WeekStrip } from '@/components/agenda/WeekStrip';"],
      ['constants/layout (compartido revisado)', "import { NAV_CLEARANCE } from '@/constants/layout';"],
      ['compartido revisado por ruta relativa', "import { Spinner } from '../../components/Spinner';"],
      ['next/navigation', "import { usePathname } from 'next/navigation';"],
      ['react', "import { useState } from 'react';"],
      ['react-dom', "import { createPortal } from 'react-dom';"],
      ['axios', "import axios, { AxiosError } from 'axios';"],
      ['next-intl', "import { useTranslations } from 'next-intl';"],
      ['zustand', "import { create } from 'zustand';"],
      ['vitest', "import { it } from 'vitest';"],
      ['testing library', "import { render } from '@testing-library/react';"],
      ['node:fs', "import { readFileSync } from 'node:fs';"],
      ['módulo builtin sin prefijo', "import path from 'path';"],
      ['import dinámico permitido', "const m = await import('@/lib/pro/errores');"],
      ['require permitido', "const e = require('./errores');"],
    ])('permite %s', (_nombre, fuente) => {
      expect(infracciones(fuente)).toEqual([]);
    });
  });

  describe('no confunde comentarios con código', () => {
    it('ignora imports comentados (de línea y de bloque)', () => {
      expect(infracciones("// import api from '@/lib/api';")).toEqual([]);
      expect(infracciones("/* import api from '@/lib/api'; */")).toEqual([]);
      expect(infracciones("/**\n * const m = import('@/lib/api');\n */\nconst a = 1;")).toEqual([]);
    });

    it('un import escrito dentro de un string se marca igual (falla cerrado, sin parser completo)', () => {
      expect(infracciones("const texto = \"import api from '@/lib/api'\";").length).toBeGreaterThan(0);
    });

    it('un comentario después del import no lo oculta', () => {
      expect(infracciones("import api from '@/lib/api'; // ok").length).toBeGreaterThan(0);
    });
  });

  it('describe cada violación con archivo y especificador', () => {
    expect(infracciones("import a from '@/lib/api';", 'components/pro/Algo.tsx')).toEqual([
      'components/pro/Algo.tsx importa "@/lib/api" (fuera de la lista permitida)',
    ]);
  });

  describe('enlaces de contacto', () => {
    it.each([
      '<a href="tel:+5491155550000">',
      "window.open('https://wa.me/549115555')",
      "window.open('https://api.whatsapp.com/send?phone=1')",
      'href="whatsapp://send?phone=1"',
      'href="sms:+5491155550000"',
      'href="mailto:a@b.c"',
      'TEL:123',
      'MAILTO:a@b.c',
    ])('detecta %s', (fuente) => {
      expect(ENLACE_DE_CONTACTO.test(fuente)).toBe(true);
    });

    it.each(['const hotel: string = "x"', 'https://turnetto.com/telefono', 'const msg = "enviado"', 'consms: 1'])(
      'no marca %s',
      (fuente) => {
        expect(ENLACE_DE_CONTACTO.test(fuente)).toBe(false);
      },
    );
  });
});
