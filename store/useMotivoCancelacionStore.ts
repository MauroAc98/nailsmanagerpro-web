import { create } from 'zustand';

// Imperative sheet for picking a cancellation reason — same promise-returning
// pattern as useConfirmStore (confirmDialog/alertDialog), rendered by the
// single <MotivoCancelacionSheetHost /> mounted once in app/providers.tsx.

export const MOTIVOS_CANCELACION = [
  'Cliente canceló con aviso',
  'Cliente no se presentó',
  'Cliente pidió reprogramar',
  'Imprevisto de la profesional',
  'Otro',
] as const;

interface MotivoCancelacionState {
  visible: boolean;
  resolve: ((value: string | null) => void) | null;
}

export const useMotivoCancelacionStore = create<MotivoCancelacionState>(() => ({
  visible: false,
  resolve: null,
}));

// Resuelve con el motivo elegido, o null si se descarta (backdrop/"Volver") —
// el caller debe tratar null como "no cancelar".
export function pedirMotivoCancelacion(): Promise<string | null> {
  return new Promise(resolve => {
    useMotivoCancelacionStore.setState({ visible: true, resolve });
  });
}

export function resolverMotivoCancelacion(motivo: string | null) {
  const { resolve } = useMotivoCancelacionStore.getState();
  if (!resolve) return;
  useMotivoCancelacionStore.setState({ visible: false, resolve: null });
  resolve(motivo);
}
