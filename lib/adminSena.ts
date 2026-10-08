// Etiqueta de la seña en la lista admin de Mercado Pago. El backend solo
// expone `sena_monto` (null en salones con seña por porcentaje, no manda
// `sena_tipo`/`sena_porcentaje`): sin monto se muestra un guion.
import { formatMonto } from './money';

export function etiquetaSenaAdmin(senaMonto: string | null): string {
  const n = senaMonto == null ? NaN : Number(senaMonto);
  return Number.isFinite(n) && n > 0 ? `Seña: $${formatMonto(n)}` : 'Seña: —';
}
