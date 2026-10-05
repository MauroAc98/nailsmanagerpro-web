import type { StoreApi } from 'zustand';
import { useAuthStore } from '@/store/useAuthStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useCobrosStore } from '@/store/useCobrosStore';
import { useGastosStore } from '@/store/useGastoStore';
import { useHistorialClienteStore } from '@/store/useHistorialClienteStore';
import { useIngresosStore } from '@/store/useIngresoStore';
import { useMotivoCancelacionStore } from '@/store/useMotivoCancelacionStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useRecordatoriosPendientesStore } from '@/store/useRecordatoriosPendientesStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useTurnoStore } from '@/store/useTurnoStore';

// Stores con datos de UN salón. Las pantallas solo refetchean cuando la lista
// está vacía (`if (x.length === 0) fetchX()`), así que si quedan cargados tras
// un logout, el siguiente salón que entra en la misma pestaña ve datos ajenos.
// Quedan afuera los stores de auth, tema, idioma, toasts y la reserva pública.
const resetear = <T>(store: StoreApi<T>) => () => store.setState(store.getInitialState(), true);

const RESETEOS_DE_DATOS = [
  resetear(useBloqueosAgendaStore),
  resetear(useCategoriasServicioStore),
  resetear(useClientesStore),
  resetear(useCobrosStore),
  resetear(useGastosStore),
  resetear(useHistorialClienteStore),
  resetear(useIngresosStore),
  resetear(useMotivoCancelacionStore),
  resetear(useNotificacionesStore),
  resetear(usePendientesDeCobroStore),
  resetear(useProfesionalStore),
  resetear(useRecordatoriosPendientesStore),
  resetear(useServiciosStore),
  resetear(useSlotsStore),
  resetear(useTurnoStore),
];

export function resetearStoresDeDatos(): void {
  for (const resetearStore of RESETEOS_DE_DATOS) resetearStore();
}

// Resetea cuando cambia la cuenta: logout, sesión revocada o cambio de
// usuario. El primer login tras abrir la app (null -> usuario) no resetea.
export function iniciarResetDeStoresPorCambioDeCuenta(): () => void {
  let idAnterior = useAuthStore.getState().user?.id ?? null;
  return useAuthStore.subscribe((state) => {
    const idActual = state.user?.id ?? null;
    if (idAnterior !== null && idActual !== idAnterior) {
      resetearStoresDeDatos();
    }
    idAnterior = idActual;
  });
}
