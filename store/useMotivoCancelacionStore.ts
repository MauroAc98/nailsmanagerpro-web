import { create } from 'zustand';
import type { PasoCancelable } from '@/lib/visitasAgenda';

// Imperative sheet for picking a cancellation reason — same promise-returning
// pattern as useConfirmStore (confirmDialog/alertDialog), rendered by the
// single <MotivoCancelacionSheetHost /> mounted once in app/providers.tsx.

export const MOTIVOS_CANCELACION = [
  'Cliente canceló con aviso',
  'Cliente no se presentó',
  'Cliente pidió reprogramar',
  'Imprevisto de quien atiende',
  'Otro',
] as const;

// Turno de un grupo (varias profesionales) tocado en su propia tarjeta: `esteTurno`
// lo nombra y la hoja deja elegir solo ese o todos; `pendientes` lista lo que cancela
// "todos" (solo lo que no esta cancelado ni completado).
// Desde la tarjeta de una visita no hay un turno tocado: `pasos` da una opcion por cada
// paso que se puede cancelar, y "todos" viene elegido.
export type ContextoCancelacionGrupo =
  | { esteTurno: string; pendientes: string[]; pasos?: undefined }
  | { pasos: PasoCancelable[]; pendientes: string[]; esteTurno?: undefined };

export type AlcanceCancelacion = 'tramo' | 'grupo';

// `turnoId` solo viene cuando se eligio un paso puntual de una visita.
export interface EleccionCancelacion {
  motivo: string;
  alcance: AlcanceCancelacion;
  turnoId?: number;
}

interface MotivoCancelacionState {
  visible: boolean;
  contexto: ContextoCancelacionGrupo | null;
  resolve: ((motivo: string | null, alcance?: AlcanceCancelacion, turnoId?: number) => void) | null;
}

export const useMotivoCancelacionStore = create<MotivoCancelacionState>(() => ({
  visible: false,
  contexto: null,
  resolve: null,
}));

// Resuelve con el motivo elegido, o null si se descarta (backdrop/"Volver") —
// el caller debe tratar null como "no cancelar".
export function pedirMotivoCancelacion(): Promise<string | null> {
  return new Promise(resolve => {
    useMotivoCancelacionStore.setState({ visible: true, contexto: null, resolve: motivo => resolve(motivo) });
  });
}

// Igual, para un turno de un grupo o una visita: ademas del motivo devuelve el alcance
// (solo un turno, o todos) y, si se eligio un paso de una visita, cual. null = no cancelar.
export function pedirCancelacionGrupo(contexto: ContextoCancelacionGrupo): Promise<EleccionCancelacion | null> {
  return new Promise(resolve => {
    useMotivoCancelacionStore.setState({
      visible: true,
      contexto,
      resolve: (motivo, alcance = 'tramo', turnoId) => {
        if (motivo === null) return resolve(null);
        resolve(turnoId === undefined ? { motivo, alcance } : { motivo, alcance, turnoId });
      },
    });
  });
}

export function resolverMotivoCancelacion(motivo: string | null, alcance?: AlcanceCancelacion, turnoId?: number) {
  const { resolve } = useMotivoCancelacionStore.getState();
  if (!resolve) return;
  useMotivoCancelacionStore.setState({ visible: false, resolve: null });
  resolve(motivo, alcance, turnoId);
}
