// mm:ss restantes para el vencimiento de la ventana de pago. Redondea hacia
// arriba: mientras quede un milisegundo la clienta todavia ve 00:01, no 00:00.
export function formatearRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
