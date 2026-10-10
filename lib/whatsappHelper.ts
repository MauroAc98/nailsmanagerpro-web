import { phoneUtils } from '@/lib/phoneUtils';

export type TipoPlantillaWhatsapp = 'confirmacion' | 'recordatorio';

// Datos ya resueltos y formateados, listos para interpolar en el cuerpo.
export interface DatosPlantillaWhatsapp {
  nombreCliente: string;
  negocio:       string;
  fecha:         string; // "DD/MM"
  hora:          string; // "HH:MM"
  servicios:     string;
  direccion:     string; // '' -> se omite la línea 📍
  profesional:   string;
  telefono:      string; // ya en formato "+54 9 AAA NNN-NNNN"; '' -> se omite la línea de contacto
}

const avisoUnidireccional = (profesional: string): string =>
  `⚠️ Desde este número solo se envían avisos. Si respondés a este mensaje, *${profesional} no lo recibe y no puede contestarte.*`;

const lineaContacto = (telefono: string): string =>
  `Para consultas o cambios de turno, comunicate al ${telefono} con al menos 24 hs de anticipación.`;

const armarCuerpo = (lineas: (string | null)[]): string =>
  lineas
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ─────────────────────────────────────────────
// cuerpoPlantillaWhatsapp — texto EXACTO de las plantillas aprobadas en Meta
// (2026-08-30, tono "sistema"): `confirmacion_turno` y `recordatorio_turno`.
//
// Fuente única para los dos lugares del frontend que muestran/mandan este
// texto: el envío manual por wa.me (`whatsappHelper.buildUrl`, abajo — sin el
// aviso de número de solo avisos) y la
// vista previa de Perfil > Mi negocio (components/perfil/SheetNegocio). Sin
// esto los dos se escribían por separado y podían divergir.
//
// El backend (NailsManagerProApi, WhatsappTemplate::mensajeLegible) tiene su
// PROPIA copia de este texto — no hay forma de compartir código entre repos.
// Si el cuerpo cambia en Meta, hay que tocar los dos lados.
//
// `reserva_turno_sena` no vive acá: nunca se manda a mano (solo la muestra
// el preview de seña de SheetNegocio, con su propio texto).
// ─────────────────────────────────────────────
export function cuerpoPlantillaWhatsapp(
  tipo: TipoPlantillaWhatsapp,
  d: DatosPlantillaWhatsapp,
  // false en el envío manual por wa.me: sale del WhatsApp del propio salón,
  // donde el cliente SÍ puede responder (ver quitarAvisoUnidireccional).
  { conAvisoUnidireccional = true }: { conAvisoUnidireccional?: boolean } = {},
): string {
  const encabezado = tipo === 'recordatorio'
    // recordatorio_turno: el punto va DENTRO de la negrita del negocio.
    ? `Hola ${d.nombreCliente}, te recordamos tu turno de mañana en *${d.negocio}.*`
    : `Hola ${d.nombreCliente}, tu turno en *${d.negocio}* quedó confirmado.`;

  // recordatorio_turno: 🕒 sin "hs"; confirmacion_turno: 🕒 con "hs".
  const lineaFechaHora = tipo === 'recordatorio'
    ? `🗓️ ${d.fecha} · 🕒 ${d.hora}`
    : `🗓️ ${d.fecha} · 🕒 ${d.hora} hs`;

  return armarCuerpo([
    encabezado,
    '',
    lineaFechaHora,
    `✨ ${d.servicios}`,
    d.direccion ? `📍 ${d.direccion}` : null,
    '',
    conAvisoUnidireccional ? avisoUnidireccional(d.profesional) : null,
    '',
    d.telefono ? lineaContacto(d.telefono) : null,
  ]);
}

// El aviso "Desde este número solo se envían avisos…" solo es cierto en el
// envío automático (número de avisos de Turnetto). Un envío manual por wa.me
// sale del WhatsApp del propio salón, donde el cliente SÍ puede responder.
// Para el texto ya armado por el backend (mensajeLegible), que trae el mismo
// párrafo; el texto armado acá lo omite con `conAvisoUnidireccional: false`.
export function quitarAvisoUnidireccional(texto: string): string {
  return texto
    .replace(/^⚠️ Desde este número solo se envían avisos\..*$/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface MessageData {
  clienteNombre:   string;
  clienteTelefono: string;
  servicio:        string;
  fecha:           string; // "YYYY-MM-DD"
  hora:            string; // "HH:MM"
  tipo:            TipoPlantillaWhatsapp;
  negocio:         string;
  direccion:       string | null;
  telefonoNegocio: string | null;
}

export const whatsappHelper = {
  buildUrl: (data: MessageData): string => {
    const [, month, day] = data.fecha.split('-');

    const cuerpo = cuerpoPlantillaWhatsapp(data.tipo, {
      nombreCliente: data.clienteNombre,
      negocio:       data.negocio,
      fecha:         `${day}/${month}`,
      hora:          data.hora,
      servicios:     data.servicio,
      direccion:     data.direccion?.trim() || '',
      profesional:   '',
      telefono:      data.telefonoNegocio ? phoneUtils.formatArWhatsapp(data.telefonoNegocio) : '',
    }, { conAvisoUnidireccional: false });

    const numeroDestino = phoneUtils.formatForWhatsApp(data.clienteTelefono);
    return `https://wa.me/${numeroDestino}?text=${encodeURIComponent(cuerpo)}`;
  },
};
