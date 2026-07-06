import { phoneUtils } from '@/lib/phoneUtils';

interface MessageData {
  clienteNombre:   string;
  clienteApellido: string;
  clienteTelefono: string;
  servicio:        string;
  fecha:           string; // "YYYY-MM-DD"
  hora:            string; // "HH:MM"
  plantilla:       string;
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
      .replace(/{hora}/g,      data.hora);

    const numeroDestino = phoneUtils.formatForWhatsApp(data.clienteTelefono);
    return `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensajeFinal)}`;
  },
};
