// Valores de REFERENCIA de la comisión de Mercado Pago según el plazo en que
// el negocio elige recibir el dinero ("Dinero disponible en" en su cuenta).
// Son % SIN IVA ni retenciones, tal cual los muestra MP en "Costos por cobro"
// (pueden variar por provincia). Son solo un atajo para el formulario: revisar
// si MP cambia su tarifario. La tasa estándar del backend es la de "instante"
// (MercadoPagoService::COMISION_MP_DEFAULT = 6.29).
export const COMISIONES_MP_REFERENCIA = [
  { id: 'instante', porcentaje: 6.29 },
  { id: 'dias10', porcentaje: 4.39 },
  { id: 'dias18', porcentaje: 3.39 },
  { id: 'dias35', porcentaje: 1.49 },
] as const;

export type PlazoMpId = (typeof COMISIONES_MP_REFERENCIA)[number]['id'];

/** "4,39" — coma decimal, lo que se escribe en el input. */
export function porcentajeParaInput(p: number): string {
  return String(p).replace('.', ',');
}

/** true si el texto del input vale exactamente `p` (acepta coma o punto). */
export function coincideConPorcentaje(texto: string, p: number): boolean {
  const limpio = texto.trim().replace(',', '.');
  return limpio !== '' && Number(limpio) === p;
}
