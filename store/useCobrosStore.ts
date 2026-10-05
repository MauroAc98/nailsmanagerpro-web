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
import { hoyLocal, rangoDeCobros, type FiltrosCobros, type PagoFiltro } from '@/lib/cobros';

export const POR_PAGINA = 30;

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

// No pisa lo que ya se ve si el pedido falla: un corte puntual no debe dejar
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
    set({ cargando: true, cargandoMas: false, error: null, filtros });
    try {
      const res = await cobrosService.listar(queryDe(filtros, 1));
      if (pedido !== ultimoPedido) return;
      set({ turnos: res.data, pagina: res.current_page, ...resumenDe(res) });
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
    const { pagina, filtros } = get();
    if (!filtros || pagina === 0) return;
    const pedido = ++ultimoPedido;
    set({ error: null });
    try {
      const paginas = await Promise.all(
        Array.from({ length: pagina }, (_, i) => cobrosService.listar(queryDe(filtros, i + 1))),
      );
      if (pedido !== ultimoPedido) return;
      const ultima = paginas[paginas.length - 1];
      set({
        turnos: paginas.flatMap(p => p.data),
        pagina: ultima.current_page,
        cargandoMas: false,
        ...resumenDe(ultima),
      });
    } catch (e) {
      if (pedido !== ultimoPedido) return;
      set({ error: extraerMensajeError(e) });
    }
  },
}));
