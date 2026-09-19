import { createMockService } from './adapters/mock';
import { createRealReads } from './adapters/real';
import { crearPublicHttp } from './publicHttp';
import type { ReservaOnlineReads, ReservaOnlineService } from './service';

export * from './service';
export * from './types';
export { reservaOnlineHabilitada } from './flag';

// Interruptor del swap (decision D5): pasa a true cuando el adapter real de
// lecturas (adapters/real.ts, tarea 2.8) este implementado y contract-testeado.
export const LECTURAS_REALES = false;

// Composicion: el mock lo implementa todo; las lecturas reales, cuando existan,
// pisan sus 3 metodos. Cada slice posterior mueve mas metodos al lado real.
export function componerServicio(
  mock: ReservaOnlineService,
  reales?: ReservaOnlineReads,
): ReservaOnlineService {
  if (!reales) return mock;
  return {
    ...mock,
    getSalon: reales.getSalon,
    getServices: reales.getServices,
    getAvailability: reales.getAvailability,
  };
}

let instancia: ReservaOnlineService | null = null;

// Seam de inyeccion: la UI pide el servicio con getService(); los tests lo
// reemplazan con setServiceParaTests(mockConReloj) sin mockear modulos.
export function getService(): ReservaOnlineService {
  if (!instancia) {
    const mock = createMockService();
    instancia = componerServicio(
      mock,
      LECTURAS_REALES ? createRealReads(crearPublicHttp()) : undefined,
    );
  }
  return instancia;
}

export function setServiceParaTests(svc: ReservaOnlineService | null): void {
  instancia = svc;
}
