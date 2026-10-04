// Orden de negocio (lunes primero) para agrupar rangos contiguos ("Lun a
// Vie") — dias_atencion llega en orden/valores Carbon (0=domingo..6=sábado),
// que no es el orden en que alguien piensa una semana laboral (mismo orden
// que ya usa WeekdayPicker para mostrar los chips).
const ORDEN_LUNES_PRIMERO = [1, 2, 3, 4, 5, 6, 0];

// Texto legible de los días que atiende una profesional, colapsando rangos
// contiguos ("Lun a Vie") en vez de listar cada día — usado en el listado de
// profesionales como reemplazo/complemento de "N servicios" (ver
// ProfesionalesPage). `null`, vacío o los 7 días marcados significan
// "atiende todos los días" (mismo criterio que diasAtencionParaGuardar).
export function formatearDiasAtencion(
  dias: number[] | null,
  abreviaturas: Record<number, string>,
  todosLosDiasLabel: string,
  conectorRango: string,
): string {
  if (dias === null || dias.length === 0 || dias.length === 7) return todosLosDiasLabel;

  const seleccionados = new Set(dias);
  const partes: string[] = [];
  let inicio: number | null = null;

  const cerrarRango = (finIdx: number) => {
    if (inicio === null) return;
    const desde = abreviaturas[ORDEN_LUNES_PRIMERO[inicio]];
    const hasta = abreviaturas[ORDEN_LUNES_PRIMERO[finIdx]];
    partes.push(inicio === finIdx ? desde : `${desde} ${conectorRango} ${hasta}`);
    inicio = null;
  };

  ORDEN_LUNES_PRIMERO.forEach((dia, idx) => {
    if (seleccionados.has(dia)) {
      if (inicio === null) inicio = idx;
    } else {
      cerrarRango(idx - 1);
    }
  });
  cerrarRango(ORDEN_LUNES_PRIMERO.length - 1);

  return partes.join(', ');
}
