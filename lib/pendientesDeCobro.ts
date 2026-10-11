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

export type ResumenBanner =
  | { tipo: 'una'; cliente: string; servicios: string; fecha_hora: string }
  | { tipo: 'varias'; cantidad: number; clientes: string[] };

// Una promo se guarda como un turno por tramo (mismo grupo_id), pero para el
// salón es UNA visita: se agrupan por grupo, y los turnos sueltos van de a uno.
function visitasDe(pendientes: Turno[]): Turno[][] {
  const porClave = new Map<string, Turno[]>();
  for (const t of pendientes) {
    const clave = t.grupo_id != null ? `g${t.grupo_id}` : `t${t.id}`;
    porClave.set(clave, [...(porClave.get(clave) ?? []), t]);
  }
  return [...porClave.values()];
}

function nombreCliente(t: Turno): string {
  return `${t.cliente?.nombre ?? ''} ${t.cliente?.apellido ?? ''}`.trim();
}

// "Cristina F.": nombre y la inicial del apellido.
function nombreCorto(t: Turno): string {
  const nombre = (t.cliente?.nombre ?? '').trim();
  const inicial = (t.cliente?.apellido ?? '').trim().charAt(0);
  return inicial ? `${nombre} ${inicial}.`.trim() : nombre;
}

// Qué se hizo en la visita: el nombre de la promo si viene de una, si no los
// servicios de todos sus turnos sin repetir.
function serviciosDeVisita(turnos: Turno[]): string {
  const promo = turnos.find(t => t.grupo?.promo)?.grupo?.promo?.nombre;
  if (promo) return promo;
  const nombres = turnos.flatMap(t => (t.servicios ?? []).filter(s => s != null).map(s => s.nombre));
  return [...new Set(nombres)].join(' + ');
}

// Qué le cuenta el banner a quien lo ve: con una sola visita pendiente, a
// quién, qué y cuándo; con varias, cuántas y de quiénes.
export function resumenParaBanner(pendientes: Turno[]): ResumenBanner {
  const visitas = visitasDe(pendientes);
  if (visitas.length === 1) {
    const turnos = ordenarPendientes(visitas[0], 'antiguos');
    const cliente = nombreCliente(turnos[0]);
    if (cliente) {
      return { tipo: 'una', cliente, servicios: serviciosDeVisita(turnos), fecha_hora: turnos[0].fecha_hora };
    }
  }
  const clientes = [...new Set(visitas.map(v => nombreCorto(v[0])).filter(Boolean))];
  return { tipo: 'varias', cantidad: visitas.length, clientes };
}

export interface CuandoFue {
  dia: 'hoy' | 'ayer' | 'otro';
  fecha: string; // "5/10"
  hora: string;  // "9:05"
}

export function cuandoFue(fechaHora: string, hoy: Date = new Date()): CuandoFue {
  const f = parseFechaHora(fechaHora);
  const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const dia = diaDe(f) === diaDe(hoy) ? 'hoy' : diaDe(f) === diaDe(ayer) ? 'ayer' : 'otro';
  return {
    dia,
    fecha: `${f.getDate()}/${f.getMonth() + 1}`,
    hora: `${f.getHours()}:${String(f.getMinutes()).padStart(2, '0')}`,
  };
}
