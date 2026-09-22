import { esRedirectSeguro } from '@/lib/esRedirectSeguro';

// El checkout_url que devuelve el backend es, segun el adapter, un path
// interno propio (mock, slug demo) o un link https:// real de Mercado Pago
// — nunca otra cosa. Se valida antes de usarlo como destino de navegacion
// (href o window.location.href) para no confiar a ciegas en el string.
export function esCheckoutUrlValida(url: string): boolean {
  // Variable intermedia a proposito: esRedirectSeguro es un type guard
  // (`path is string`) sobre un parametro que ya es `string` — usarlo
  // directo en el `||` de abajo hace que TS angoste `url` a `never` en la
  // rama derecha.
  const interno: boolean = esRedirectSeguro(url);

  return interno || url.startsWith('https://');
}
