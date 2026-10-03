import type { NotificacionMensaje } from '@/services/turnoService';

// Clave del texto de una fila de notificacion (namespace common.NotificacionesBell).
export function claveTextoNotificacion(tipo: NotificacionMensaje['tipo'], status: NotificacionMensaje['status']): string {
  const base = tipo === 'confirmacion' ? 'confirmacion' : tipo === 'reprogramacion' ? 'reprogramacion' : 'recordatorio';
  const fallido = status === 'failed';
  if (base === 'recordatorio') return fallido ? 'recordatorioFallido' : 'recordatorioEnviado';
  return `${base}${fallido ? 'Fallida' : 'Enviada'}`;
}
