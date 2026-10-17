import type { FiltrosTurnos } from '@/services/proService';
import type { FiltrosAgenda } from '@/store/useProAgendaStore';
import { rangoPermitido } from './fechaHora';

// Reglas de los filtros de la agenda del portal. Funciones puras: la pantalla
// valida ANTES de pedir y un valor inválido nunca genera un request.

export const BUSCAR_MAX_CARACTERES = 60;
export const BUSCAR_MAX_PALABRAS = 5;

export type ResultadoBuscar = 'ok' | 'demasiadasPalabras' | 'larga';

// Recorta y colapsa los espacios internos. No corta el largo: un texto largo se
// informa como inválido en vez de recortarse en silencio.
export function normalizarBuscar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

export function validarBuscar(texto: string): ResultadoBuscar {
  const normal = normalizarBuscar(texto);
  if (normal === '') return 'ok';
  if (normal.split(' ').length > BUSCAR_MAX_PALABRAS) return 'demasiadasPalabras';
  return normal.length > BUSCAR_MAX_CARACTERES ? 'larga' : 'ok';
}

export function hayFiltrosActivos(f: FiltrosAgenda): boolean {
  return normalizarBuscar(f.buscar) !== '' || f.servicioId !== null || f.desde !== null || f.hasta !== null;
}

// Parámetros del pedido. Sin rango se consulta el día elegido (rango de un día).
// null = hay un valor inválido: no se pide nada.
export function filtrosAParams(f: FiltrosAgenda, fecha: string): FiltrosTurnos | null {
  if ((f.desde === null) !== (f.hasta === null)) return null;
  const desde = f.desde ?? fecha;
  const hasta = f.hasta ?? fecha;
  const buscar = normalizarBuscar(f.buscar);
  if (validarBuscar(buscar) !== 'ok' || !rangoPermitido(desde, hasta)) return null;
  if (f.servicioId !== null && !(Number.isSafeInteger(f.servicioId) && f.servicioId > 0)) return null;
  return {
    desde,
    hasta,
    ...(buscar !== '' ? { buscar } : {}),
    ...(f.servicioId !== null ? { servicio_id: f.servicioId } : {}),
  };
}
