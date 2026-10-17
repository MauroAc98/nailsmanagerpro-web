// Resolver PURO de rutas del portal de profesionales: estado de la sesión +
// ruta actual -> permitir, redirigir o dejar en blanco. Es la única fuente de
// verdad del guard (components/pro/ProGuard.tsx): el efecto de navegación y el
// render leen la misma decisión y no pueden contradecirse.
//
// No usa lib/resolveAuthRoute.ts (design D4): ese resolver tiene `/cambiar-
// password` y `/subscription-expired` fijos, sin prefijo `/pro`, y su estado no
// conoce vínculos ni portal no disponible.
//
// Funciona igual en los dos modos de URL: limpias en profesionales.turnetto.com
// ("/agenda") y bajo /pro en localhost ("/pro/agenda"). La decisión se toma
// sobre la ruta limpia y el redirect vuelve en el mismo modo que el pathname
// de entrada.

import type { AccesoPro } from '@/lib/pro/acceso';
import { conPrefijoPro, rutaLimpiaPro } from '@/lib/pro/rutas';

export type ProAuthStatus = 'booting' | 'anonymous' | 'restricted' | 'loadingMe' | 'full' | 'portalUnavailable';

export interface SnapshotRutaPro {
  status: ProAuthStatus;
  // Solo cuenta con status 'full'.
  acceso: AccesoPro;
}

export type RutaPro = { type: 'allow' } | { type: 'redirect'; to: string } | { type: 'blank' };

export type ClaseRutaPro =
  | 'publica'
  | 'cambiarPassword'
  | 'negocios'
  | 'app'
  | 'accesoDeshabilitado'
  | 'sinServicio'
  | 'noDisponible'
  // La raíz y cualquier ruta que no es del portal: nunca se muestran, siempre
  // llevan al destino del estado.
  | 'otra';

// Rutas limpias de TODAS las pantallas del portal, incluidas las que agregan
// los slices siguientes: cada slice solo suma su página.
const RUTAS_EXACTAS: Readonly<Record<string, ClaseRutaPro>> = {
  '/login': 'publica',
  '/olvide-password': 'publica',
  '/restablecer-password': 'publica',
  '/cambiar-password': 'cambiarPassword',
  '/negocios': 'negocios',
  '/agenda': 'app',
  '/cuenta': 'app',
  '/acceso-deshabilitado': 'accesoDeshabilitado',
  '/sin-servicio': 'sinServicio',
  '/no-disponible': 'noDisponible',
};

// /turnos/[id]: un solo segmento. /turnos y /turnos/1/2 no existen.
const RUTA_DETALLE_TURNO = /^\/turnos\/[^/]+$/;

function sinBarraFinal(ruta: string): string {
  const recortada = ruta.replace(/\/+$/, '');
  return recortada === '' ? '/' : recortada;
}

// `ruta` ya es limpia (sin /pro). hasOwnProperty.call para que "/constructor"
// o "/__proto__" no resuelvan contra el prototipo del objeto.
export function claseDeRutaPro(ruta: string): ClaseRutaPro {
  const normalizada = sinBarraFinal(ruta);
  if (Object.prototype.hasOwnProperty.call(RUTAS_EXACTAS, normalizada)) return RUTAS_EXACTAS[normalizada];
  return RUTA_DETALLE_TURNO.test(normalizada) ? 'app' : 'otra';
}

interface ReglasPro {
  permitidas: readonly ClaseRutaPro[];
  // A dónde se manda a quien está en una ruta que no le corresponde. Siempre es
  // una de las `permitidas`: así un redirect nunca produce otro redirect.
  destino: string;
}

const REGLAS_FIJAS: Readonly<Record<'anonymous' | 'restricted' | 'portalUnavailable', ReglasPro>> = {
  anonymous: { permitidas: ['publica'], destino: '/login' },
  // Un token restringido solo sirve para cambiar la contraseña (o cerrar sesión).
  restricted: { permitidas: ['cambiarPassword'], destino: '/cambiar-password' },
  // El portal no disponible no cierra una sesión válida: solo cambia de pantalla.
  portalUnavailable: { permitidas: ['noDisponible'], destino: '/no-disponible' },
};

const REGLAS_POR_ACCESO: Readonly<Record<AccesoPro, ReglasPro>> = {
  // El chooser siempre es accesible con sesión completa y negocio usable: es
  // donde se cambia de negocio.
  listo: { permitidas: ['app', 'negocios'], destino: '/agenda' },
  elegir: { permitidas: ['negocios'], destino: '/negocios' },
  // En los estados bloqueados el cambio de negocio es un sheet de la propia
  // pantalla de estado (no una ruta): al elegir otro, el acceso pasa a 'listo'
  // y el resolver saca de acá.
  deshabilitado: { permitidas: ['accesoDeshabilitado'], destino: '/acceso-deshabilitado' },
  sinServicio: { permitidas: ['sinServicio'], destino: '/sin-servicio' },
};

function reglasDe(snapshot: SnapshotRutaPro): ReglasPro | null {
  switch (snapshot.status) {
    case 'booting':
    case 'loadingMe':
      return null;
    case 'full':
      return REGLAS_POR_ACCESO[snapshot.acceso];
    default:
      return REGLAS_FIJAS[snapshot.status];
  }
}

export function resolveProRoute(snapshot: SnapshotRutaPro, pathname: string): RutaPro {
  const reglas = reglasDe(snapshot);
  // Sin estado resuelto no se decide nada: ni se muestra contenido ni se redirige.
  if (reglas === null) return { type: 'blank' };

  const clase = claseDeRutaPro(rutaLimpiaPro(pathname));
  if (reglas.permitidas.includes(clase)) return { type: 'allow' };
  return { type: 'redirect', to: conPrefijoPro(reglas.destino, pathname) };
}
