import type { Turno } from '@/services/turnoService';
import { formatoYMD } from '@/lib/dateFormat';

// "YYYY-MM-DD HH:MM" — mismo prefijo que devuelve el backend en fecha_hora
// (con espacio o con 'T'), comparable como string sin parsear husos.
const claveFecha = (t: Turno) => t.fecha_hora.slice(0, 16).replace('T', ' ');

function claveAhora(ahora: Date): string {
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mm = String(ahora.getMinutes()).padStart(2, '0');
  return `${formatoYMD(ahora)} ${hh}:${mm}`;
}

// Orden de los resultados del sheet "Filtrar": primero lo que todavía hay
// que atender (en curso o a futuro, el más próximo arriba), después lo ya
// pasado — finalizados y confirmados vencidos sin cerrar — del más reciente
// al más antiguo. Ordenar todo ascendente dejaba arriba los turnos viejos
// ya finalizados.
export function ordenarTurnosBusqueda(turnos: Turno[], ahora: Date = new Date()): Turno[] {
  const limite = claveAhora(ahora);
  const porAtender = (t: Turno) =>
    t.estado_visual === 'en_curso' || (t.estado_visual !== 'completado' && claveFecha(t) >= limite);

  const proximos = turnos.filter(porAtender).sort((a, b) => claveFecha(a).localeCompare(claveFecha(b)));
  const pasados  = turnos.filter(t => !porAtender(t)).sort((a, b) => claveFecha(b).localeCompare(claveFecha(a)));
  return [...proximos, ...pasados];
}
