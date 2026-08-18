import { create } from 'zustand';
import {
  clienteService,
  Cliente,
  CreateClienteDto,
  UpdateClienteDto,
  extraerMensajeError,
} from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
interface OperacionResult {
  success: boolean;
  message?: string;
}

interface ClientesState {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;

  // Estado de la lista paginada con scroll infinito virtualizado (ver
  // app/(app)/clientes/page.tsx) — completamente separado de `clientes`/
  // `fetchClientes` de arriba, que sigue alimentando SIN cambios al picker
  // de cliente de Agenda (nuevo/editar turno), el cual necesita la lista
  // completa para buscar/autocompletar. `buscarActivo` es plumbing interno
  // (el término con el que se cargó la página actual, para poder pedir la
  // siguiente con el mismo filtro) — no pensado para lectura externa.
  clientesPagina: Cliente[];
  paginaActual: number;
  totalPaginas: number;
  totalClientesPagina: number;
  cargandoPagina: boolean;
  cargandoMasPagina: boolean;
  buscarActivo: string;

  fetchClientes: () => Promise<void>;
  crearCliente: (dto: CreateClienteDto) => Promise<OperacionResult>;
  actualizarCliente: (id: number, dto: UpdateClienteDto) => Promise<OperacionResult>;
  eliminarCliente: (id: number) => Promise<OperacionResult>;
  toggleCliente: (id: number, activo: boolean) => Promise<OperacionResult>;
  cargarPrimeraPagina: (buscar: string) => Promise<void>;
  cargarSiguientePagina: () => Promise<void>;
  clearError: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useClientesStore = create<ClientesState>((set, get) => ({
  clientes: [],
  loading: false,
  error: null,

  clientesPagina: [],
  paginaActual: 0,
  totalPaginas: 0,
  totalClientesPagina: 0,
  cargandoPagina: false,
  cargandoMasPagina: false,
  buscarActivo: '',

  clearError: () => set({ error: null }),

  // ─────────────────────────────────────────────
  // fetchClientes
  // ─────────────────────────────────────────────
  fetchClientes: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const clientes = await clienteService.getAll();
        set({ clientes });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  // ─────────────────────────────────────────────
  // crearCliente
  // ─────────────────────────────────────────────
  crearCliente: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        const nuevo = await clienteService.create(dto);
        set(state => ({ clientes: [...state.clientes, nuevo] }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // actualizarCliente
  // ─────────────────────────────────────────────
  actualizarCliente: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        const actualizado = await clienteService.update(id, dto);
        set(state => ({
          clientes: state.clientes.map(c => c.id === id ? actualizado : c),
        }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // eliminarCliente
  // ─────────────────────────────────────────────
  eliminarCliente: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await clienteService.destroy(id);
        const clientes = await clienteService.getAll();
        set({ clientes });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // toggleCliente
  // ─────────────────────────────────────────────
  toggleCliente: async (id, activo) => {
    set(state => ({
      clientes: state.clientes.map(c => c.id === id ? { ...c, activo } : c),
      clientesPagina: state.clientesPagina.map(c => c.id === id ? { ...c, activo } : c),
    }));
    return withGlobalLoader(async () => {
      try {
        await clienteService.update(id, { activo });
        return { success: true };
      } catch (e) {
        set(state => ({
          clientes: state.clientes.map(c => c.id === id ? { ...c, activo: !activo } : c),
          clientesPagina: state.clientesPagina.map(c => c.id === id ? { ...c, activo: !activo } : c),
        }));
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // cargarPrimeraPagina / cargarSiguientePagina — lista paginada con scroll
  // infinito virtualizado (ver app/(app)/clientes/page.tsx). Sin
  // withGlobalLoader: usan su propio loading local (cargandoPagina/
  // cargandoMasPagina) para no tapar la pantalla con el spinner global en
  // cada búsqueda o scroll.
  // ─────────────────────────────────────────────
  cargarPrimeraPagina: async (buscar) => {
    set({ cargandoPagina: true, error: null, buscarActivo: buscar });
    try {
      const res = await clienteService.getPaginado({ page: 1, buscar });
      set({
        clientesPagina: res.data,
        paginaActual: res.current_page,
        totalPaginas: res.last_page,
        totalClientesPagina: res.total,
      });
    } catch (e) {
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ cargandoPagina: false });
    }
  },

  cargarSiguientePagina: async () => {
    const { paginaActual, totalPaginas, cargandoMasPagina, buscarActivo } = get();
    if (cargandoMasPagina || paginaActual === 0 || paginaActual >= totalPaginas) return;
    set({ cargandoMasPagina: true });
    try {
      const res = await clienteService.getPaginado({ page: paginaActual + 1, buscar: buscarActivo });
      set(state => ({
        clientesPagina: [...state.clientesPagina, ...res.data],
        paginaActual: res.current_page,
        totalPaginas: res.last_page,
      }));
    } catch (e) {
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ cargandoMasPagina: false });
    }
  },
}));
