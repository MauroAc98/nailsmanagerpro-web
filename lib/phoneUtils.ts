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
};
