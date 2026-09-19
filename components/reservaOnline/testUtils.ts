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

// Estado de flujo listo hasta el paso pedido (demo: servicios 1 y 2, Ana). Desde
// 'datos' el horario queda RETENIDO en el servicio (hold real del mock), como
// pasa al tocar Continuar en el horario; en 'resumen' tambien se guardan los datos.
export async function flujoHasta(
  paso: 'horario' | 'datos' | 'resumen',
  svc?: MockReservaOnlineService,
): Promise<void> {
  const s = useReservaOnlineStore.getState();
  s.activarSlug('demo');
  s.setServicios([1, 2]);
  s.setProfesional(1);
  if (paso === 'horario') return;
  if (!svc) throw new Error('flujoHasta(' + paso + ') necesita el servicio mock');
  s.setHorario('2026-09-25', '13:00');
  const h = await svc.retenerHorario('demo', {
    servicioIds: [1, 2],
    profesionalId: 1,
    fecha: '2026-09-25',
    hora: '13:00',
  });
  s.setHold({ reservaId: h.reservaId, expiraMs: h.expiresAtMs, profesionalId: h.profesionalId });
  if (paso === 'datos') return;
  const cliente = { nombre: 'Marta', apellido: 'Ríos', whatsapp: '+5493765123456' };
  s.setCliente(cliente);
  await svc.actualizarDatosReserva('demo', h.reservaId, { cliente });
}
