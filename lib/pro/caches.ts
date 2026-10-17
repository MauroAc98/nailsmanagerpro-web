// Cachés en memoria de los datos del portal, UNA por recurso. Las claves llevan
// SIEMPRE el id del vínculo adelante (`${vinculoId}:...`) y se vacían todas al
// cambiar de negocio, de cuenta o al cerrar sesión (registrarResetPorNegocio, ver
// store/useProAgendaStore). No hay otro estado de módulo con datos del negocio.
import { crearCacheLru, type CacheLru } from '@/lib/cacheLru';
import type { ProListaTurnos, ProMarcas, ProResumen, ProServicios, ProTurno } from '@/lib/pro/tipos';

export const CACHE_MAX_ENTRADAS = 12;
export const CACHE_VIGENCIA_MS = 60_000;

const nueva = <V>(): CacheLru<V> => crearCacheLru<V>(CACHE_MAX_ENTRADAS, CACHE_VIGENCIA_MS);

export const cacheTurnosDia = nueva<ProListaTurnos>(); // `${vid}:dia:${fecha}`
export const cacheTurnosRango = nueva<ProListaTurnos>(); // `${vid}:rango:...`
export const cacheMarcas = nueva<ProMarcas>(); // `${vid}:marcas:${mes}`
export const cacheServicios = nueva<ProServicios>(); // `${vid}:servicios`
export const cacheResumen = nueva<ProResumen>(); // `${vid}:resumen:${mes}`
export const cacheTurno = nueva<ProTurno>(); // `${vid}:turno:${id}`

export function vaciarCachesPro(): void {
  cacheTurnosDia.clear();
  cacheTurnosRango.clear();
  cacheMarcas.clear();
  cacheServicios.clear();
  cacheResumen.clear();
  cacheTurno.clear();
}
