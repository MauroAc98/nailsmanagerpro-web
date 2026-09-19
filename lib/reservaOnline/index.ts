import { createMockService } from './adapters/mock';
import { createRealReads } from './adapters/real';
import { crearPublicHttp } from './publicHttp';
import type { ReservaOnlineReads, ReservaOnlineService } from './service';

export * from './service';
export * from './types';
export { reservaOnlineHabilitada } from './flag';

// Interruptor del swap (decision D5): el adapter real de lecturas (tarea 2.8)
// ya esta implementado y contract-testeado contra el backend.
export const LECTURAS_REALES = true;

// Salones que siempre se sirven con el mock, aunque las lecturas sean reales:
// `demo` permite previsualizar el flujo sin datos ni backend.
export const SLUGS_MOCK: readonly string[] = ['demo'];

// Fuerza el mock para TODOS los slugs en desarrollo (build-time, inlineado).
const forzarMock = (): boolean => process.env.NEXT_PUBLIC_RESERVA_ONLINE_MOCK === 'true';

// Composicion: el mock lo implementa todo; las lecturas reales pisan sus 3
// metodos salvo para los slugs mock. Cada slice posterior mueve mas metodos al
// lado real.
export function componerServicio(
  mock: ReservaOnlineService,
  reales?: ReservaOnlineReads,
  slugsMock: readonly string[] = SLUGS_MOCK,
): ReservaOnlineService {
  if (!reales) return mock;
  const esMock = (slug: string) => slugsMock.includes(slug);
  return {
    ...mock,
    getSalon: (slug) => (esMock(slug) ? mock : reales).getSalon(slug),
    getServices: (slug, q) => (esMock(slug) ? mock : reales).getServices(slug, q),
    getAvailability: (slug, q) => (esMock(slug) ? mock : reales).getAvailability(slug, q),
  };
}

let instancia: ReservaOnlineService | null = null;

// Seam de inyeccion: la UI pide el servicio con getService(); los tests lo
// reemplazan con setServiceParaTests(mockConReloj) sin mockear modulos.
export function getService(): ReservaOnlineService {
  if (!instancia) {
    const reales =
      LECTURAS_REALES && !forzarMock() ? createRealReads(crearPublicHttp()) : undefined;
    const mock = createMockService({ lecturas: reales });
    instancia = componerServicio(mock, reales);
  }
  return instancia;
}

export function setServiceParaTests(svc: ReservaOnlineService | null): void {
  instancia = svc;
}
