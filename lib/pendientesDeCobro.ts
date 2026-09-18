import type { Turno } from '@/services/turnoService';

export type OrdenPendientes = 'antiguos' | 'recientes';
export type GrupoSemana = 'estaSemana' | 'semanaPasada' | 'anteriores';

export interface GrupoPendientes {
  grupo: GrupoSemana;
  turnos: Turno[];
}

// Precios de referencia del catálogo, por id de servicio.
export type PreciosDeLista = Map<number, string | number | null | undefined>;

function precioDeLista(referencias: PreciosDeLista, servicioId: number): number | null {
  const ref = referencias.get(servicioId);
  return ref != null && ref !== '' ? Number(ref) : null;
}

// Estimado a precio de lista: suma solo los servicios que tienen precio en el
// catálogo (los demás no aportan nada al estimado).
export function estimadoAPrecioDeLista(turno: Turno, referencias: PreciosDeLista): number {
  return turno.servicios.reduce((acc, s) => acc + (precioDeLista(referencias, s.id) ?? 0), 0);
}

// "Usar precio de lista" solo tiene sentido si TODOS los servicios tienen
// precio en el catálogo; si no, hay que cargarlo a mano.
export function tienePrecioDeListaCompleto(turno: Turno, referencias: PreciosDeLista): boolean {
  return turno.servicios.length > 0 && turno.servicios.every(s => precioDeLista(referencias, s.id) !== null);
}

function parseFechaHora(fechaHora: string): Date {
  return new Date(fechaHora.replace(' ', 'T'));
}

export function ordenarPendientes(turnos: Turno[], orden: OrdenPendientes): Turno[] {
  const factor = orden === 'antiguos' ? 1 : -1;
  return [...turnos].sort(
    (a, b) => factor * (parseFechaHora(a.fecha_hora).getTime() - parseFechaHora(b.fecha_hora).getTime())
  );
}

// Lunes 00:00 de la semana (lunes a domingo) que contiene a `fecha`.
function inicioDeSemana(fecha: Date): number {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const diasDesdeLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasDesdeLunes);
  return d.getTime();
}

function grupoDe(fechaHora: string, hoy: Date): GrupoSemana {
  const semanaTurno = inicioDeSemana(parseFechaHora(fechaHora));
  const semanaActual = inicioDeSemana(hoy);
  if (semanaTurno >= semanaActual) return 'estaSemana';
  const semanaPasada = new Date(semanaActual);
  semanaPasada.setDate(semanaPasada.getDate() - 7);
  return semanaTurno === semanaPasada.getTime() ? 'semanaPasada' : 'anteriores';
}

// Agrupa respetando el orden de la lista recibida: los turnos consecutivos
// de la misma semana forman un grupo.
export function agruparPorSemana(turnos: Turno[], hoy: Date = new Date()): GrupoPendientes[] {
  const grupos: GrupoPendientes[] = [];
  for (const turno of turnos) {
    const grupo = grupoDe(turno.fecha_hora, hoy);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grupo === grupo) ultimo.turnos.push(turno);
    else grupos.push({ grupo, turnos: [turno] });
  }
  return grupos;
}
