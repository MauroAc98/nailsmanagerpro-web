import { parsearMonto } from '@/lib/parsearMonto';

export type ResultadoPrecioServicio =
  | { ok: true; valor: number }
  | { ok: false; error: 'required' | 'invalid' };

// El precio de un servicio es obligatorio (salvo una promo con componentes,
// cuyo precio sale de ellos: ese caso no pasa por acá).
export function validarPrecioServicio(texto: string): ResultadoPrecioServicio {
  if (!texto.trim()) return { ok: false, error: 'required' };
  const valor = parsearMonto(texto);
  return valor === null ? { ok: false, error: 'invalid' } : { ok: true, valor };
}
