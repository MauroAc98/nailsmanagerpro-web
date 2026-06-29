import api from '@/lib/api';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
}

export interface CreateClienteDto {
  nombre: string;
  apellido: string;
  telefono: string;
}

export type UpdateClienteDto = Partial<CreateClienteDto>;

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const clienteService = {
  getAll: async (): Promise<Cliente[]> => {
    const { data } = await api.get<Cliente[]>('/clientes');
    return data;
  },

  getOne: async (id: number): Promise<Cliente> => {
    const { data } = await api.get<Cliente>(`/clientes/${id}`);
    return data;
  },

  create: async (dto: CreateClienteDto): Promise<Cliente> => {
    const { data } = await api.post<Cliente>('/clientes', dto);
    return data;
  },

  update: async (id: number, dto: UpdateClienteDto): Promise<Cliente> => {
    const { data } = await api.put<Cliente>(`/clientes/${id}`, dto);
    return data;
  },

  destroy: async (id: number): Promise<void> => {
    await api.delete(`/clientes/${id}`);
  },
};

export const extraerMensajeError = (e: unknown): string => {
  if (e && typeof e === 'object' && 'response' in e) {
    const err = e as { response?: { data?: { message?: string } } };
    return err.response?.data?.message ?? 'Error inesperado';
  }
  return 'Error inesperado';
};
