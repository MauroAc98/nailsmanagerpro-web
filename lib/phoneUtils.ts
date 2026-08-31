export const PAISES = [
  { codigo: '54',  label: '🇦🇷 +54'  },
  { codigo: '55',  label: '🇧🇷 +55'  },
  { codigo: '598', label: '🇺🇾 +598' },
  { codigo: '595', label: '🇵🇾 +595' },
  { codigo: '56',  label: '🇨🇱 +56'  },
  { codigo: '591', label: '🇧🇴 +591' },
];

// Los más largos primero, para no matchear "54" en un código de 3 dígitos
// que también empiece con esos caracteres.
const PREFIJOS_ORDENADOS = [...PAISES]
  .map(p => p.codigo)
  .sort((a, b) => b.length - a.length);

export const phoneUtils = {
  clean: (fullNumber: string): string => fullNumber.replace(/\D/g, ''),

  // WhatsApp requiere el "9" después del código de país para celulares
  // argentinos (54) — sin esto el link puede no abrir el chat correcto.
  formatForWhatsApp: (fullNumber: string): string => {
    let num = phoneUtils.clean(fullNumber);
    if (num.startsWith('54') && num.charAt(2) !== '9') {
      num = `549${num.substring(2)}`;
    }
    return num;
  },

  // Separa un número completo (guardado como +54... o pegado con código de
  // país incluido) en código de país + número local, para precargar el
  // selector y el input por separado.
  splitCodigoPais: (fullNumber: string): { codigo: string; numero: string } => {
    const raw = phoneUtils.clean(fullNumber);
    if (!raw) return { codigo: '54', numero: '' };
    const prefijo = PREFIJOS_ORDENADOS.find(p => raw.startsWith(p));
    return prefijo
      ? { codigo: prefijo, numero: raw.slice(prefijo.length) }
      : { codigo: '54', numero: raw };
  },

  // Formato de lectura ("376 474-1700") para mostrar un teléfono en UI, no
  // para linkear — a diferencia de formatForWhatsApp/splitCodigoPais, este
  // campo (telefono del estudio, perfil) es texto libre sin selector de país
  // asociado, así que no asumimos dónde termina un código de país: los
  // últimos 4 dígitos siempre quedan como bloque final con guion (el
  // "número" propiamente dicho), y todo lo anterior (área + código de país,
  // si lo hay) se agrupa de a 3 desde la izquierda. Con un número local de
  // 10 dígitos da exactamente "XXX XXX-XXXX"; con más dígitos (código de
  // país incluido) sigue leyéndose en bloques en vez de un bloque corrido.
  formatDisplay: (fullNumber: string): string => {
    const d = phoneUtils.clean(fullNumber);
    if (d.length < 6) return d;
    const ultimo = d.slice(-4);
    const resto  = d.slice(0, -4);
    const grupos = resto.match(/.{1,3}/g) ?? [resto];
    return `${grupos.join(' ')}-${ultimo}`;
  },

  // Formato internacional AR para el CUERPO de las plantillas de WhatsApp
  // (confirmacion / recordatorio / reserva_sena). Espeja
  // WhatsappTemplate::formatearTelefono() del backend (NailsManagerProApi):
  // normaliza cualquier forma de carga a "+54 9 AAA NNN-NNNN" para que
  // WhatsApp lo haga tappable en el chat. Si no puede derivar un nacional de
  // 10 dígitos, devuelve el input crudo (no tappable pero no roto).
  formatArWhatsapp: (raw: string): string => {
    let d = phoneUtils.clean(raw);
    if (d.startsWith('54')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('9')) d = d.slice(1);
    if (d.length !== 10) return raw;
    // AMBA usa código de área "11" (2 dígitos) + abonado de 8; el resto del
    // país usa área de 3 + abonado de 7.
    const [area, central, final] = d.startsWith('11')
      ? [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)]
      : [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)];
    return `+54 9 ${area} ${central}-${final}`;
  },
};
