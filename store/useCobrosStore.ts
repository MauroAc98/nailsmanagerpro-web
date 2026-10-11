import { create } from 'zustand';
import {
  cobrosService,
  type CobrosListaBulk,
  type CobrosPagina,
  type CobrosQuery,
  type CobrosResumen,
  type TurnoConCobro,
} from '@/services/cobrosService';
import { extraerMensajeError } from '@/services/clienteService';
import { crearCacheLru } from '@/lib/cacheLru';
import { hoyLocal, rangoDeCobros, type FiltrosCobros, type PagoFiltro } from '@/lib/cobros';

export const POR_PAGINA = 30;
// Cuántos filtros recuerda la caché en memoria (los últimos usados).
export const MAX_CLAVES_CACHE = 8;

const RESUMEN_VACIO: CobrosResumen = {
  sena_cobrada: 0,
  cobrado_finalizados: 0,
  falta_cobrar: 0,
  sin_precio_count: 0,
  sin_precio_estimado: 0,
  sena_en_pendientes: 0,
  cobrado_total: 0,
};
const CONTEOS_VACIOS: Record<PagoFiltro, number> = { todos: 0, sena: 0, todo: 0, nada: 0, sinprecio: 0 };
const LISTA_BULK_VACIA: CobrosListaBulk = { count: 0, total: 0, items: [] };

interface CobrosState {
  turnos: TurnoConCobro[];
  pagina: number;
  ultimaPagina: number;
  total: number;
  // Conteos y totales del conjunto filtrado COMPLETO (no solo lo cargado).
  counts: Record<PagoFiltro, number>;
  resumen: CobrosResumen;
  listaBulk: CobrosListaBulk;
  cargando: boolean;
  cargandoMas: boolean;
  error: string | null;
  // Filtros con los que se cargó lo que se ve (para pedir las páginas siguientes).
  filtros: FiltrosCobros | null;

  cargarPrimeraPagina: (filtros: FiltrosCobros) => Promise<void>;
  cargarSiguientePagina: () => Promise<void>;
  recargar: () => Promise<void>;
}

// Lo último que se vio de cada filtro: al volver se muestra al instante y se
// refresca de fondo. Solo en memoria; cualquier `recargar` (tras guardar un
// precio) la descarta para no mostrar datos viejos de plata.
type Instantanea = Pick<CobrosState, 'turnos' | 'pagina' | 'ultimaPagina' | 'total' | 'counts' | 'resumen' | 'listaBulk'>;
const cache = crearCacheLru<Instantanea>(MAX_CLAVES_CACHE);
export const vaciarCacheCobros = () => cache.clear();

const claveDe = (f: FiltrosCobros) => `${f.turno}|${f.pago}|${f.periodo}|${f.buscar}`;

// Cada pedido se numera: si mientras vuela otro se cambian los filtros (o se
// recarga), su respuesta ya no vale y se descarta.
let ultimoPedido = 0;

function queryDe(filtros: FiltrosCobros, page: number): CobrosQuery {
  const query: CobrosQuery = {
    page,
    per_page: POR_PAGINA,
    turno: filtros.turno,
    pago: filtros.pago,
    periodo: filtros.periodo,
    ...rangoDeCobros(),
    hoy: hoyLocal(),
  };
  if (filtros.buscar) query.buscar = filtros.buscar;
  return query;
}

const resumenDe = (res: CobrosPagina) => ({
  total: res.total,
  ultimaPagina: res.last_page,
  counts: res.counts,
  resumen: res.resumen,
  listaBulk: res.lista_bulk,
});

const traerPaginas = (filtros: FiltrosCobros, cantidad: number) =>
  Promise.all(Array.from({ length: cantidad }, (_, i) => cobrosService.listar(queryDe(filtros, i + 1))));

function guardarEnCache(s: CobrosState) {
  if (!s.filtros) return;
  const { turnos, pagina, ultimaPagina, total, counts, resumen, listaBulk } = s;
  cache.set(claveDe(s.filtros), { turnos, pagina, ultimaPagina, total, counts, resumen, listaBulk });
}

const VACIO: Instantanea = {
  turnos: [], pagina: 0, ultimaPagina: 0, total: 0, counts: CONTEOS_VACIOS, resumen: RESUMEN_VACIO, listaBulk: LISTA_BULK_VACIA,
};

// Un error de red no pisa lo cacheado que ya se ve: un corte puntual no debe
// dejar la pantalla vacía. No pisa lo que ya se ve si el pedido falla: un corte puntual no debe dejar
// la pantalla vacía.
export const useCobrosStore = create<CobrosState>((set, get) => ({
  turnos: [],
  pagina: 0,
  ultimaPagina: 0,
  total: 0,
  counts: CONTEOS_VACIOS,
  resumen: RESUMEN_VACIO,
  listaBulk: LISTA_BULK_VACIA,
  cargando: false,
  cargandoMas: false,
  error: null,
  filtros: null,

  cargarPrimeraPagina: async (filtros) => {
    const pedido = ++ultimoPedido;
    const clave = claveDe(filtros);
    const visto = cache.get(clave);
    // Filtro ya visto: se muestra lo cacheado sin "cargando" y se refresca de
    // fondo. Filtro nuevo: se vacía, así nunca se ve la lista de otro filtro.
    if (visto) set({ ...visto, cargando: false, cargandoMas: false, error: null, filtros });
    else set({ ...VACIO, cargando: true, cargandoMas: false, error: null, filtros });
    try {
      const paginas = visto
        ? await traerPaginas(filtros, visto.pagina)
        : [await cobrosService.listar(queryDe(filtros, 1))];
      if (pedido !== ultimoPedido) return;
      const ultima = paginas[paginas.length - 1];
      set({ turnos: paginas.flatMap(p => p.data), pagina: ultima.current_page, ...resumenDe(ultima) });
      guardarEnCache(get());
    } catch (e) {
      if (pedido !== ultimoPedido) return;
      set({ error: extraerMensajeError(e) });
    } finally {
      if (pedido === ultimoPedido) set({ cargando: false });
    }
  },

  cargarSiguientePagina: async () => {
    const { pagina, ultimaPagina, cargandoMas, cargando, filtros } = get();
    if (cargandoMas || cargando || !filtros || pagina === 0 || pagina >= ultimaPagina) return;
    const pedido = ++ultimoPedido;
    set({ cargandoMas: true });
    try {
      const res = await cobrosService.listar(queryDe(filtros, pagina + 1));
      if (pedido !== ultimoPedido) return;
      set(state => ({ turnos: [...state.turnos, ...res.data], pagina: res.current_page, ...resumenDe(res) }));
      guardarEnCache(get());
    } catch (e) {
      if (pedido !== ultimoPedido) return;
      set({ error: extraerMensajeError(e) });
    } finally {
      if (pedido === ultimoPedido) set({ cargandoMas: false });
    }
  },

  // Tras cobrar un turno cambian su estado, los conteos y los totales: se
  // vuelven a pedir TODAS las páginas ya cargadas, así la lista no salta ni se
  // pierde lo que la persona venía scrolleando.
  recargar: async () => {
    cache.clear();
    const { pagina, filtros } = get();
    if (!filtros || pagina === 0) return;
    const pedido = ++ultimoPedido;
    set({ error: null });
    try {
      const paginas = await traerPaginas(filtros, pagina);
      if (pedido !== ultimoPedido) return;
      const ultima = paginas[paginas.length - 1];
      set({
        turnos: paginas.flatMap(p => p.data),
        pagina: ultima.current_page,
        cargandoMas: false,
        ...resumenDe(ultima),
      });
      guardarEnCache(get());
    } catch (e) {
      if (pedido !== ultimoPedido) return;
      set({ error: extraerMensajeError(e) });
    }
  },
}));
