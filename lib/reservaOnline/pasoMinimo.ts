import { esWhatsappE164 } from './whatsappE164';
import type { ClienteInput, Fecha, Hora, HoldFlujo } from './types';

export type Paso = 'servicios' | 'horario' | 'datos' | 'resumen';

// Datos del flujo que persiste el store (sin acciones).
export interface FlowData {
  servicioIds: number[];
  profesionalId: number | 'any';
  fecha: Fecha | null;
  hora: Hora | null;
  cliente: ClienteInput;
  // Horario retenido al elegirlo (null = todavia no se retuvo o se solto).
  hold: HoldFlujo | null;
  // "Contanos tu idea" (opcional).
  nota: string;
}

// Primer paso incompleto del flujo. Cada pagina redirige aca al montar, asi un
// deep link o un refresh con estado vacio no deja a la clienta en un paso sin datos.
export function pasoMinimo(d: FlowData): Paso {
  if (d.servicioIds.length === 0) return 'servicios';
  if (!d.fecha || !d.hora) return 'horario';
  // Sin retencion no se puede completar datos ni pagar. Un hold VENCIDO no
  // redirige: la pantalla lo explica ("Se liberó tu horario").
  if (!d.hold) return 'horario';
  const { nombre, apellido, whatsapp } = d.cliente;
  if (!nombre.trim() || !apellido.trim() || !esWhatsappE164(whatsapp)) return 'datos';
  return 'resumen';
}
