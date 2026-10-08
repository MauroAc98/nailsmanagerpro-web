import type { Turno } from '@/services/turnoService';

// Visitas de la agenda: los turnos de un mismo grupo (una promo o varios servicios
// agendados juntos) y del mismo dia se muestran como UNA tarjeta con un paso por
// turno. Funciones puras, sin React.

type Tramo = NonNullable<Turno['grupo']>['tramos'][number];

export interface PasoVisita {
  turnoId: number;
  // "YYYY-MM-DDTHH:MM:SS" tal como viene del grupo.
  hora: string;
  duracionMin: number;
  servicios: string[];
  profesionalId: number;
  profesionalNombre: string | null;
  // Los cancelados no se muestran, asi que solo estos dos.
  estado: 'confirmado' | 'completado';
  enCurso: boolean;
  // Paso de otro dia: se muestra apagado, con su fecha.
  otroDia: boolean;
  // Con filtro de profesional: true si el paso es de esa persona. Sin filtro: null.
  propio: boolean | null;
  // El turno real cuando esta en la lista (los de otro dia no estan).
  turno?: Turno;
}

export interface VisitaAgenda {
  tipo: 'visita';
  grupoId: number;
  promo: { id: number; nombre: string } | null;
  // Turno de la lista que da el cliente y el telefono de la tarjeta.
  cabecera: Turno;
  // Los turnos de la lista que son de esta visita (del dia).
  turnos: Turno[];
  pasos: PasoVisita[];
}

export interface TurnoSuelto {
  tipo: 'turno';
  turno: Turno;
}

export type ItemAgenda = VisitaAgenda | TurnoSuelto;

const dia = (fechaHora: string): string => fechaHora.replace(' ', 'T').slice(0, 10);
const nombresDe = (servicios: ({ nombre: string } | null)[] | undefined): string[] =>
  (servicios ?? []).filter((s) => s != null).map((s) => s.nombre);

// Una visita necesita al menos 2 pasos que no esten cancelados; con uno solo es un turno normal.
const pasosVigentes = (turno: Turno): Tramo[] =>
  (turno.grupo?.tramos ?? []).filter((t) => t.estado !== 'cancelado');

/**
 * Arma los items de la agenda a partir de la lista de turnos (todos los profesionales,
 * sin cancelados). El orden de salida es el de la lista de entrada: cada visita queda
 * donde esta su turno "ancla" — el de la persona filtrada o, sin filtro, el primero del dia —
 * asi se respeta tanto el orden por hora de un dia como el de los resultados de busqueda.
 * Con `profesionalFiltro`, solo quedan los items donde esa persona tiene un turno del dia.
 */
export function agruparVisitas(turnos: Turno[], profesionalFiltro: number | null = null): ItemAgenda[] {
  const porId = new Map(turnos.map((t) => [t.id, t]));
  // ancla = indice en la lista del turno donde se ubica el item; -1 = todavia sin ancla.
  type Registro = { item: ItemAgenda; ancla: number };
  const visitas = new Map<string, Registro & { item: VisitaAgenda }>();
  const resultado: Registro[] = [];

  turnos.forEach((turno, indice) => {
    const esSuyo = profesionalFiltro === null || turno.profesional_id === profesionalFiltro;
    const vigentes = pasosVigentes(turno);

    if (turno.grupo_id == null || vigentes.length < 2) {
      if (esSuyo) resultado.push({ item: { tipo: 'turno', turno }, ancla: indice });
      return;
    }

    const diaVisita = dia(turno.fecha_hora);
    const clave = `${turno.grupo_id}|${diaVisita}`;
    let entrada = visitas.get(clave);
    if (!entrada) {
      const pasos: PasoVisita[] = [...vigentes]
        .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora) || a.turno_id - b.turno_id)
        .map((t) => {
          const enLista = porId.get(t.turno_id);
          return {
            turnoId: t.turno_id,
            hora: t.fecha_hora,
            duracionMin: t.duracion_total_minutos,
            servicios: t.servicios ? nombresDe(t.servicios) : nombresDe(enLista?.servicios),
            profesionalId: t.profesional_id,
            profesionalNombre: t.profesional_nombre,
            estado: t.estado as PasoVisita['estado'],
            enCurso: enLista?.estado_visual === 'en_curso',
            otroDia: dia(t.fecha_hora) !== diaVisita,
            propio: profesionalFiltro === null ? null : t.profesional_id === profesionalFiltro,
            turno: enLista,
          };
        });
      entrada = {
        item: {
          tipo: 'visita', grupoId: turno.grupo_id, promo: turno.grupo?.promo ?? null,
          cabecera: turno, turnos: [], pasos,
        },
        ancla: -1,
      };
      visitas.set(clave, entrada);
      resultado.push(entrada);
    }
    entrada.item.turnos.push(turno);
    if (entrada.ancla < 0 && esSuyo) entrada.ancla = indice;
  });

  // Una visita sin ancla es de otra persona: con filtro, no se muestra.
  return resultado
    .filter((r) => r.ancla >= 0)
    .sort((a, b) => a.ancla - b.ancla)
    .map((r) => r.item);
}
