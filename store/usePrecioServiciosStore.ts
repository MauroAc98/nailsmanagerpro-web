import { create } from 'zustand';

// Imperative sheet for entering the final price of each service in a turno
// before marking it as completado — same promise-returning pattern as
// useMotivoCancelacionStore, rendered by the single <PrecioServiciosSheetHost />
// mounted once in app/providers.tsx.

export interface ServicioAPrecificar {
  servicio_id: number;
  nombre: string;
  // Precio de referencia del catálogo (Servicio.precio), solo para prefill —
  // null si el servicio no tiene precio de referencia cargado.
  precioReferencia: number | null;
}

// Contexto para mostrar en el encabezado del sheet. `modo` cambia el
// vocabulario: 'finalizar' (cierra el turno) vs 'cargar' (turno ya finalizado
// al que solo le falta el precio, desde "Precios por cargar").
export interface ContextoPrecios {
  cliente?: string;
  fechaHora?: string;
  modo?: 'finalizar' | 'cargar';
}

interface PrecioServiciosState {
  visible: boolean;
  servicios: ServicioAPrecificar[];
  contexto: ContextoPrecios | null;
  resolve: ((value: { servicio_id: number; precio: number }[] | null) => void) | null;
}

export const usePrecioServiciosStore = create<PrecioServiciosState>(() => ({
  visible: false,
  servicios: [],
  contexto: null,
  resolve: null,
}));

// Resuelve con el precio final de cada servicio, o null si se descarta
// (backdrop/"Volver") — el caller debe tratar null como "no completar".
export function pedirPreciosServicios(
  servicios: ServicioAPrecificar[],
  contexto: ContextoPrecios | null = null
): Promise<{ servicio_id: number; precio: number }[] | null> {
  return new Promise(resolve => {
    usePrecioServiciosStore.setState({ visible: true, servicios, contexto, resolve });
  });
}

export function resolverPreciosServicios(precios: { servicio_id: number; precio: number }[] | null) {
  const { resolve } = usePrecioServiciosStore.getState();
  if (!resolve) return;
  usePrecioServiciosStore.setState({ visible: false, servicios: [], contexto: null, resolve: null });
  resolve(precios);
}
