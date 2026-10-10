// Helpers de fecha del tablero "Uso de la app". Todo se calcula en la zona
// horaria de los salones (Buenos Aires), no la del navegador del admin.
const TZ = 'America/Argentina/Buenos_Aires';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Más de esta cantidad de días sin turnos = negocio inactivo.
export const DIAS_INACTIVO = 14;

const formateador = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function partes(epoch: number) {
  const p: Record<string, string> = {};
  for (const x of formateador.formatToParts(new Date(epoch * 1000))) p[x.type] = x.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour.padStart(2, '0'), mm: p.minute.padStart(2, '0') };
}

// Días calendario entre el día del epoch y hoy, ambos en Buenos Aires.
export function diasDesde(epoch: number | null, ahoraEpoch: number = Math.floor(Date.now() / 1000)): number | null {
  if (epoch === null) return null;
  const a = partes(epoch);
  const b = partes(ahoraEpoch);
  const dias = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  return Math.max(0, dias);
}

// "18 sep, 16:45 hs"
export function formatUltimoTurno(epoch: number): string {
  const p = partes(epoch);
  return `${p.d} ${MESES[p.m - 1]}, ${p.hh}:${p.mm} hs`;
}

// { fecha: "19/09/2026", hora: "09:03" }
export function formatFechaHora(epoch: number): { fecha: string; hora: string } {
  const p = partes(epoch);
  return { fecha: `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`, hora: `${p.hh}:${p.mm}` };
}

// Número grande + unidad chica de la tarjeta.
export function textoDias(dias: number | null): { numero: string; unidad: string } {
  if (dias === null) return { numero: '—', unidad: '' };
  if (dias === 0) return { numero: 'Hoy', unidad: '' };
  return { numero: String(dias), unidad: dias === 1 ? 'día' : 'días' };
}

export function esNegocioActivo(dias: number | null): boolean {
  return dias !== null && dias <= DIAS_INACTIVO;
}
