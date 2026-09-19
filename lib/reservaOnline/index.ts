import { createMockService } from './adapters/mock';
import { createRealReads } from './adapters/real';
import { createRealWrites, type ReservaOnlineWritesReales } from './adapters/realWrites';
import { crearPublicHttp } from './publicHttp';
import type { ReservaOnlineReads, ReservaOnlineService } from './service';

export * from './service';
export * from './types';
export { reservaOnlineHabilitada } from './flag';

// Interruptor del swap (decision D5): el adapter real de lecturas (tarea 2.8)
// ya esta implementado y contract-testeado contra el backend.
export const LECTURAS_REALES = true;

// Interruptor del swap de las 5 escrituras (hold, datos, pago, liberar,
// estado): el adapter real de la slice 3 ya esta implementado y
// contract-testeado contra un HTTP stubbeado (el kill switch del backend,
// RESERVAS_CREACION_HABILITADA, decide si esos endpoints responden o dan 503).
export const ESCRITURAS_REALES = true;

// Salones que siempre se sirven con el mock, aunque las lecturas/escrituras
// sean reales: `demo` permite previsualizar el flujo sin datos ni backend.
export const SLUGS_MOCK: readonly string[] = ['demo'];

// Fuerza el mock para TODOS los slugs en desarrollo (build-time, inlineado).
const forzarMock = (): boolean => process.env.NEXT_PUBLIC_RESERVA_ONLINE_MOCK === 'true';

// Composicion: el mock lo implementa todo; las lecturas y las escrituras
// reales pisan sus metodos salvo para los slugs mock. Cada slice posterior
// mueve mas metodos al lado real (ajustes, Mercado Pago, fotos y el listado
// siguen en el mock hasta sus propias slices).
export function componerServicio(
  mock: ReservaOnlineService,
  reales?: ReservaOnlineReads,
  escrituras?: ReservaOnlineWritesReales,
  slugsMock: readonly string[] = SLUGS_MOCK,
): ReservaOnlineService {
  if (!reales && !escrituras) return mock;
  const esMock = (slug: string) => slugsMock.includes(slug);
  return {
    ...mock,
    getSalon: (slug) => (reales && !esMock(slug) ? reales : mock).getSalon(slug),
    getServices: (slug, q) => (reales && !esMock(slug) ? reales : mock).getServices(slug, q),
    getAvailability: (slug, q) => (reales && !esMock(slug) ? reales : mock).getAvailability(slug, q),
    getDiasConDisponibilidad: (slug, q) =>
      (reales && !esMock(slug) ? reales : mock).getDiasConDisponibilidad(slug, q),
    retenerHorario: (slug, input) => (escrituras && !esMock(slug) ? escrituras : mock).retenerHorario(slug, input),
    actualizarDatosReserva: (slug, id, datos) =>
      (escrituras && !esMock(slug) ? escrituras : mock).actualizarDatosReserva(slug, id, datos),
    iniciarPago: (slug, id) => (escrituras && !esMock(slug) ? escrituras : mock).iniciarPago(slug, id),
    liberarHold: (slug, id) => (escrituras && !esMock(slug) ? escrituras : mock).liberarHold(slug, id),
    getReservationStatus: (slug, id) =>
      (escrituras && !esMock(slug) ? escrituras : mock).getReservationStatus(slug, id),
  };
}

let instancia: ReservaOnlineService | null = null;

// Seam de inyeccion: la UI pide el servicio con getService(); los tests lo
// reemplazan con setServiceParaTests(mockConReloj) sin mockear modulos.
export function getService(): ReservaOnlineService {
  if (!instancia) {
    const http = crearPublicHttp();
    const forzado = forzarMock();
    const reales = LECTURAS_REALES && !forzado ? createRealReads(http) : undefined;
    const escrituras = ESCRITURAS_REALES && !forzado ? createRealWrites(http) : undefined;
    const mock = createMockService({ lecturas: reales });
    instancia = componerServicio(mock, reales, escrituras);
  }
  return instancia;
}

export function setServiceParaTests(svc: ReservaOnlineService | null): void {
  instancia = svc;
}
