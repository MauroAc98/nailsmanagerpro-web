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
  buscar: string;

  fetchClientes: () => Promise<void>;
  crearCliente: (dto: CreateClienteDto) => Promise<OperacionResult>;
  actualizarCliente: (id: number, dto: UpdateClienteDto) => Promise<OperacionResult>;
  eliminarCliente: (id: number) => Promise<OperacionResult>;
  setBuscar: (texto: string) => void;
  clearError: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useClientesStore = create<ClientesState>((set, get) => ({
  clientes: [],
  loading: false,
  error: null,
  buscar: '',

  setBuscar: (texto) => set({ buscar: texto }),
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
        set(state => ({ clientes: state.clientes.filter(c => c.id !== id) }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

// ─────────────────────────────────────────────
// Selector: clientes filtrados client-side
// ─────────────────────────────────────────────
export const useClientesFiltrados = () => {
  const { clientes, buscar } = useClientesStore();
  if (!buscar.trim()) return clientes;
  const q = buscar.toLowerCase();
  return clientes.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
    c.telefono.includes(q)
  );
};
