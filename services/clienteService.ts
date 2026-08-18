import api from '@/lib/api';
import type { Turno } from '@/services/turnoService';
import { tStatic } from '@/store/useLocaleStore';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  activo: boolean;
  // Solo viene en getOne() (ClienteController::show eager-carga turnos.servicios,
  // sin filtrar por estado — incluye cancelados). getAll() no lo trae.
  turnos?: Turno[];
}

export interface CreateClienteDto {
  nombre: string;
  apellido: string;
  telefono: string;
}

export type UpdateClienteDto = Partial<CreateClienteDto> & { activo?: boolean };

export interface ClientesPaginados {
  data: Cliente[];
  current_page: number;
  last_page: number;
  total: number;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────
export const clienteService = {
  getAll: async (): Promise<Cliente[]> => {
    const { data } = await api.get<Cliente[]>('/clientes');
    return data;
  },

  // Lista paginada + búsqueda server-side, para la pantalla de lista con
  // scroll infinito virtualizado (ver useClienteStore.cargarPrimeraPagina /
  // cargarSiguientePagina). Pega contra el mismo endpoint que getAll(), pero
  // mandar `page` activa el shape paginado en el backend (ver
  // ClienteController::index) — getAll() (sin `page`) sigue devolviendo el
  // array plano de siempre, usado por el picker de cliente en Agenda.
  getPaginado: async (params: { page: number; perPage?: number; buscar?: string }): Promise<ClientesPaginados> => {
    const { data } = await api.get<ClientesPaginados>('/clientes', {
      params: { page: params.page, per_page: params.perPage ?? 30, buscar: params.buscar || undefined },
    });
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
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
    // Laravel pone el mensaje específico de un campo bajo `errors.<campo>[0]`
    // — el `message` de nivel superior es siempre el genérico "The given
    // data was invalid." de ValidationException. Priorizamos el mensaje de
    // campo cuando existe (ej. el límite de fotos de historia-precios).
    const primerMensajeDeCampo = Object.values(err.response?.data?.errors ?? {})[0]?.[0];
    return primerMensajeDeCampo ?? err.response?.data?.message ?? tStatic('common.Errors.unexpectedError');
  }
  return tStatic('common.Errors.unexpectedError');
};
