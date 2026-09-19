import { esWhatsappE164 } from './whatsappE164';
import type { ClienteInput, Fecha, Hora } from './types';

export type Paso = 'servicios' | 'horario' | 'datos' | 'resumen';

// Datos del flujo que persiste el store (sin acciones).
export interface FlowData {
  servicioIds: number[];
  profesionalId: number | 'any';
  fecha: Fecha | null;
  hora: Hora | null;
  cliente: ClienteInput;
  reservaId: string | null;
}

// Primer paso incompleto del flujo. Cada pagina redirige aca al montar, asi un
// deep link o un refresh con estado vacio no deja a la clienta en un paso sin datos.
export function pasoMinimo(d: FlowData): Paso {
  if (d.servicioIds.length === 0) return 'servicios';
  if (!d.fecha || !d.hora) return 'horario';
  const { nombre, apellido, whatsapp } = d.cliente;
  if (!nombre.trim() || !apellido.trim() || !esWhatsappE164(whatsapp)) return 'datos';
  return 'resumen';
}
