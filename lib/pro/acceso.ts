// Acceso de una sesión completa del portal al negocio elegido. PURO: lo usan el
// store (para decidir qué hacer al cargar `me`) y el guard (para resolver la
// ruta). Un vínculo puede estar bloqueado por dos vías: porque `me` lo informó
// como no disponible (disponible=false + motivo) o porque una llamada de datos
// recibió VINCULO_NO_DISPONIBLE / un 403 de suscripción (bloqueos del store).

import type { MotivoVinculo } from '@/lib/pro/errores';
import type { ProVinculo } from '@/lib/pro/tipos';

export interface BloqueoVinculo {
  // disabled = la persona titular quitó el acceso; noService = el negocio no
  // tiene servicio (suscripción vencida, suspendida o inexistente).
  estado: 'disabled' | 'noService';
  motivo: MotivoVinculo | null;
}

export type BloqueosVinculo = Record<number, BloqueoVinculo>;

// listo = hay un negocio activo y usable; elegir = hay que pasar por la lista de
// negocios; deshabilitado / sinServicio = pantalla de estado (SE-11).
export type AccesoPro = 'listo' | 'elegir' | 'deshabilitado' | 'sinServicio';

// El bloqueo detectado en una llamada de datos gana sobre lo que dijo `me`: es
// más reciente. Sin ninguno de los dos, el vínculo no está bloqueado.
export function bloqueoEfectivo(vinculo: ProVinculo, bloqueos: BloqueosVinculo): BloqueoVinculo | null {
  const detectado = bloqueos[vinculo.id];
  if (detectado) return detectado;
  return vinculo.disponible ? null : { estado: 'noService', motivo: vinculo.motivo };
}

const pantallaDe = (bloqueo: BloqueoVinculo): AccesoPro => (bloqueo.estado === 'disabled' ? 'deshabilitado' : 'sinServicio');

export function calcularAcceso(
  vinculos: readonly ProVinculo[],
  vinculoActivoId: number | null,
  bloqueos: BloqueosVinculo,
): AccesoPro {
  if (vinculos.length === 0) return 'deshabilitado';

  // Un id activo que `me` ya no lista (el vínculo se quitó) cuenta como ninguno.
  const activo = vinculos.find((v) => v.id === vinculoActivoId);
  if (activo) {
    const bloqueo = bloqueoEfectivo(activo, bloqueos);
    return bloqueo ? pantallaDe(bloqueo) : 'listo';
  }

  const bloqueosDeTodos = vinculos.map((v) => bloqueoEfectivo(v, bloqueos));
  if (bloqueosDeTodos.some((b) => b === null)) return 'elegir';

  // Todos bloqueados: la lista vacía no sirve. Solo es "deshabilitado" si NINGUNO
  // tiene la causa de servicio; si alguno la tiene, la explicación útil es esa.
  return bloqueosDeTodos.every((b) => b?.estado === 'disabled') ? 'deshabilitado' : 'sinServicio';
}
