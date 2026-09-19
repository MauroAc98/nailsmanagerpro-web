// Link publico de reserva que la duena comparte. En produccion sale de
// NEXT_PUBLIC_RESERVA_BASE_URL (ej. https://reservar.turnetto.com, requiere
// que la infra sirva /<slug> en ese host); sin la variable (dev) cae a
// `${origin}/reservar`.
export function linkReserva(slug: string, opts: { base?: string; origin: string }): string {
  const base = opts.base?.trim() ? opts.base.trim().replace(/\/+$/, '') : `${opts.origin}/reservar`;
  return `${base}/${slug}`;
}

// Version para mostrar en pantalla (sin protocolo).
export const linkReservaCorto = (url: string): string => url.replace(/^https?:\/\//, '');
