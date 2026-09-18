import { useLocaleStore } from '@/store/useLocaleStore';

// Mismo motivo que nombreDia/nombreMes en dateFormat.ts: se apoya en
// Intl.NumberFormat leyendo el locale activo (no en next-intl useFormatter)
// para poder llamarse también desde código que no es un componente React.
//
// Separador de miles vía Intl en vez de `toFixed(2)` a mano — `toFixed`
// nunca agrupa dígitos, así que $2066000.00 quedaba ilegible a simple
// vista. El símbolo "$" queda afuera de este helper (igual que antes):
// cada call site lo antepone, porque no es un formato de moneda con
// código ISO, es un monto libre en la moneda local del negocio.
function localeActivo(): string {
  return useLocaleStore.getState().locale;
}

// El locale 'es' a secas (CLDR, minimumGroupingDigits=2) no agrupa los
// números de 4 dígitos: 5000 -> "5000,00" pero 12500 -> "12.500,00", y los
// montos de la app quedaban inconsistentes entre sí. La moneda del negocio es
// el peso argentino: 'es-AR' agrupa desde 1.000 ("5.000,00"), igual que el
// backend en los mensajes de WhatsApp. pt-BR ya agrupa desde 1.000.
function localeMonto(): string {
  const locale = localeActivo();
  return locale === 'es' ? 'es-AR' : locale;
}

export function formatMonto(monto: number): string {
  return new Intl.NumberFormat(localeMonto(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}

// Como formatMonto pero sin decimales cuando el monto es entero: para
// montos de lista/totales donde ",00" solo agrega ruido ("$18.000").
export function formatMontoCorto(monto: number): string {
  return new Intl.NumberFormat(localeMonto(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto);
}
