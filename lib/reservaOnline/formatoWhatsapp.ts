import { PAISES } from '@/lib/phoneUtils';

const PREFIJOS = PAISES.map((p) => p.codigo).sort((a, b) => b.length - a.length);

const agrupar = (digitos: string, tam: number): string =>
  (digitos.match(new RegExp(`.{1,${tam}}`, 'g')) ?? []).join(' ');

// Muestra un WhatsApp E.164 de forma legible para que la persona pueda
// reconocer si esta bien tipeado. Solo presentacion: nunca pierde digitos.
// Argentina: +54 9 <area> <numero>, ej. +54 9 376 479-4897 (area de 2 digitos
// para el 11, de 3 para el resto; los de 4 digitos igual se leen completos).
export function formatearWhatsapp(e164: string): string {
  const digitos = e164.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('549') && digitos.length > 5) {
    const local = digitos.slice(3);
    const area = local.startsWith('11') ? 2 : 3;
    const resto = local.slice(area);
    const abonado = resto.length > 4 ? `${resto.slice(0, -4)}-${resto.slice(-4)}` : resto;
    return `+54 9 ${local.slice(0, area)} ${abonado}`.trim();
  }
  const codigo = PREFIJOS.find((p) => digitos.startsWith(p));
  if (!codigo) return `+${agrupar(digitos, 3)}`;
  return `+${codigo} ${agrupar(digitos.slice(codigo.length), 3)}`.trim();
}
