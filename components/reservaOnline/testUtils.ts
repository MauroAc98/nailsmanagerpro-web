import { createMockService, memoriaStorage, type MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';

// Helpers SOLO de tests para las pantallas del flujo publico: servicio mock
// con reloj fijo inyectado por el seam (sin vi.mock) y store limpio.

// 2026-09-19 12:00 hora del salon (UTC-3).
export const AHORA = Date.UTC(2026, 8, 19, 15, 0);

export function prepararServicio(now: () => number = () => AHORA): MockReservaOnlineService {
  const svc = createMockService({ now, storage: memoriaStorage() });
  setServiceParaTests(svc);
  return svc;
}

export function limpiarFlujo(): void {
  sessionStorage.clear();
  useReservaOnlineStore.getState().reiniciar();
}

// Estado de flujo listo hasta el paso pedido (demo: servicios 1 y 2, Ana).
export function flujoHasta(paso: 'horario' | 'datos' | 'resumen'): void {
  const s = useReservaOnlineStore.getState();
  s.activarSlug('demo');
  s.setServicios([1, 2]);
  s.setProfesional(1);
  if (paso === 'horario') return;
  s.setHorario('2026-09-25', '13:00');
  if (paso === 'datos') return;
  s.setCliente({ nombre: 'Marta', apellido: 'Ríos', whatsapp: '+5493765123456' });
}
