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

export function formatMonto(monto: number): string {
  return new Intl.NumberFormat(localeActivo(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}
