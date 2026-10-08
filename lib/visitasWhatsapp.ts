import { whatsappHelper } from '@/lib/whatsappHelper';
import type { VisitaAgenda } from '@/lib/visitasAgenda';

export interface NegocioWhatsapp {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
}

const primerNombre = (nombre: string | null): string => (nombre ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * Enlace de WhatsApp con el recordatorio de UNA visita: un solo mensaje con los pasos
 * confirmados del dia de la tarjeta (no los completados ni los de otro dia), con la
 * fecha y la hora del primero. Mismo formato que el mensaje automatico del backend
 * (WhatsappTemplate::parametrosCloudApi): con varias profesionales, "Capping con Ana ·
 * Soft gel con Laura" y el aviso nombra a "el equipo"; con una sola, los servicios
 * juntos con " + " y su nombre. null si el cliente no tiene telefono o no queda ningun paso.
 */
export function urlWhatsappVisita(visita: VisitaAgenda, negocio: NegocioWhatsapp): string | null {
  const cliente = visita.cabecera.cliente;
  const pasos = visita.pasos.filter((p) => p.estado === 'confirmado' && !p.otroDia);
  if (!cliente?.telefono || pasos.length === 0) return null;

  const nombres = [...new Set(pasos.map((p) => primerNombre(p.profesionalNombre)).filter(Boolean))];
  const variasProfesionales = nombres.length > 1;

  const servicio = variasProfesionales
    ? pasos
        .map((p) => {
          const servicios = p.servicios.join(' + ');
          const nombre = primerNombre(p.profesionalNombre);
          return servicios !== '' && nombre !== '' ? `${servicios} con ${nombre}` : servicios;
        })
        .filter(Boolean)
        .join(' · ')
    : pasos.flatMap((p) => p.servicios).join(' + ');

  const inicio = pasos[0].hora;
  return whatsappHelper.buildUrl({
    clienteNombre: cliente.nombre,
    clienteTelefono: cliente.telefono,
    servicio,
    fecha: inicio.slice(0, 10),
    hora: inicio.slice(11, 16),
    tipo: 'recordatorio',
    negocio: negocio.nombre,
    direccion: negocio.direccion,
    telefonoNegocio: negocio.telefono,
    profesional: variasProfesionales ? 'el equipo' : nombres[0],
  });
}
