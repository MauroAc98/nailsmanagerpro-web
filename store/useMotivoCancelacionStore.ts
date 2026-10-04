import { create } from 'zustand';

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

// Turno de un grupo (varias profesionales): `esteTurno` nombra el turno que se
// toco y `pendientes` lista lo que cancela "todo el combo" (solo lo que no esta
// cancelado ni completado).
export interface ContextoCancelacionGrupo {
  esteTurno: string;
  pendientes: string[];
}

export type AlcanceCancelacion = 'tramo' | 'grupo';

interface MotivoCancelacionState {
  visible: boolean;
  contexto: ContextoCancelacionGrupo | null;
  resolve: ((motivo: string | null, alcance?: AlcanceCancelacion) => void) | null;
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

// Igual, para un turno de un grupo: ademas del motivo devuelve el alcance
// (solo este turno, o todo el combo). null = no cancelar.
export function pedirCancelacionGrupo(
  contexto: ContextoCancelacionGrupo,
): Promise<{ motivo: string; alcance: AlcanceCancelacion } | null> {
  return new Promise(resolve => {
    useMotivoCancelacionStore.setState({
      visible: true,
      contexto,
      resolve: (motivo, alcance = 'tramo') => resolve(motivo === null ? null : { motivo, alcance }),
    });
  });
}

export function resolverMotivoCancelacion(motivo: string | null, alcance?: AlcanceCancelacion) {
  const { resolve } = useMotivoCancelacionStore.getState();
  if (!resolve) return;
  useMotivoCancelacionStore.setState({ visible: false, resolve: null });
  resolve(motivo, alcance);
}
