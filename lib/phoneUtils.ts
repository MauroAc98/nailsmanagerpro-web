export const PAISES = [
  { codigo: '54',  label: '🇦🇷 +54'  },
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
};
