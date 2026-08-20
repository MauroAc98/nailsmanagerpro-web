import { phoneUtils } from '@/lib/phoneUtils';

// Texto para el fallback manual (wa.me) — WhatsApp Cloud API manda un texto
// fijo aprobado por Meta, no personalizable por profesional; este es el
// mismo texto que se usaba como default antes de sacar la edición.
export const PLANTILLA_RECORDATORIO_DEFAULT =
  'Hola {nombre} 💅 Te recuerdo tu turno el {fecha} a las {hora} para {servicios}. ¡Te espero!';
export const PLANTILLA_CONFIRMACION_DEFAULT =
  'Hola {nombre} 💅 Tu turno de {servicios} está confirmado para el {fecha} a las {hora}. ¡Te espero!';

interface MessageData {
  clienteNombre:   string;
  clienteApellido: string;
  clienteTelefono: string;
  servicio:        string;
  fecha:           string; // "YYYY-MM-DD"
  hora:            string; // "HH:MM"
  plantilla:       string;
  profesional?:    string;
}

export const whatsappHelper = {
  buildUrl: (data: MessageData): string => {
    const [, month, day] = data.fecha.split('-');
    const fechaFormateada = `${day}/${month}`;

    const mensajeFinal = data.plantilla
      .replace(/{nombre}/g,    data.clienteNombre)
      .replace(/{apellido}/g,  data.clienteApellido)
      .replace(/{servicios}/g, data.servicio)
      .replace(/{fecha}/g,     fechaFormateada)
      .replace(/{hora}/g,      data.hora)
      .replace(/{profesional}/g, data.profesional ?? '');

    const numeroDestino = phoneUtils.formatForWhatsApp(data.clienteTelefono);
    return `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensajeFinal)}`;
  },
};
