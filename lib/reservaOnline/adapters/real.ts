import type { AxiosInstance } from 'axios';
import type { ReservaOnlineReads } from '../service';

// STUB de la tarea 2.8 (adapter real de lecturas). Depende del backend de
// lecturas publicas (PublicController info/servicios/disponibilidad), que esta
// en desarrollo aparte. Cuando exista:
//   1. implementar los 3 metodos sobre `http` (crearPublicHttp) con un unico
//      mapper snake_case -> camelCase;
//   2. correr describeReadsContract('real', ...) con un adapter HTTP stubbeado
//      con los 3 JSON exactos del diseno;
//   3. activar LECTURAS_REALES en ../index.ts.
// Hasta entonces la composicion sigue usando el mock para todo.
export function createRealReads(_http: AxiosInstance): ReservaOnlineReads {
  const pendiente = (): never => {
    throw new Error('adapter real de lecturas pendiente (tarea 2.8, requiere backend)');
  };
  return {
    getSalon: pendiente,
    getServices: pendiente,
    getAvailability: pendiente,
  };
}
