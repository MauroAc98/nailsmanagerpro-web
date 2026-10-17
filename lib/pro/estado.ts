// Mapa de estado_visual del portal a clave de i18n y colores (tokens del tema
// de la agenda). Un estado que el backend agregue mañana cae en "desconocido"
// con un estilo neutro, en vez de romper o quedar sin rótulo.

import { agendaColors } from '@/theme/agendaColors';
import { ESTADOS_VISUALES, type EstadoVisual } from '@/lib/pro/tipos';

export type ClaveEstado = EstadoVisual | 'desconocido';

export interface InfoEstado {
  clave: ClaveEstado;
  fg: string;
  bg: string;
}

const ESTILOS: Record<ClaveEstado, { fg: string; bg: string }> = {
  confirmado: { fg: agendaColors.primaryDeep, bg: agendaColors.primarySoft },
  en_curso: { fg: agendaColors.amberFg, bg: agendaColors.amberBg },
  completado: { fg: agendaColors.success, bg: agendaColors.successBg },
  desconocido: { fg: agendaColors.sub, bg: agendaColors.surface2 },
};

export function infoEstado(estado: unknown): InfoEstado {
  // includes() sobre la lista cerrada: 'constructor' o '__proto__' no pasan.
  const clave: ClaveEstado =
    typeof estado === 'string' && (ESTADOS_VISUALES as readonly string[]).includes(estado)
      ? (estado as EstadoVisual)
      : 'desconocido';
  return { clave, ...ESTILOS[clave] };
}
