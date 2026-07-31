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

interface PrecioServiciosState {
  visible: boolean;
  servicios: ServicioAPrecificar[];
  resolve: ((value: { servicio_id: number; precio: number }[] | null) => void) | null;
}

export const usePrecioServiciosStore = create<PrecioServiciosState>(() => ({
  visible: false,
  servicios: [],
  resolve: null,
}));

// Resuelve con el precio final de cada servicio, o null si se descarta
// (backdrop/"Volver") — el caller debe tratar null como "no completar".
export function pedirPreciosServicios(
  servicios: ServicioAPrecificar[]
): Promise<{ servicio_id: number; precio: number }[] | null> {
  return new Promise(resolve => {
    usePrecioServiciosStore.setState({ visible: true, servicios, resolve });
  });
}

export function resolverPreciosServicios(precios: { servicio_id: number; precio: number }[] | null) {
  const { resolve } = usePrecioServiciosStore.getState();
  if (!resolve) return;
  usePrecioServiciosStore.setState({ visible: false, servicios: [], resolve: null });
  resolve(precios);
}
