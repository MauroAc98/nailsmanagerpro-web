import api from '@/lib/api';

export interface ServicioMasPedido {
  servicio_id: number;
  nombre: string;
  cantidad: number;
}

export interface DashboardStats {
  total_turnos: number;
  turnos_por_estado: {
    completados: number;
    confirmados: number;
    cancelados: number;
  };
  servicios_mas_pedidos: ServicioMasPedido[];
  clientes: {
    nuevas: number;
    recurrentes: number;
  };
}

export const statsService = {
  // profesionalId opcional — mismo patrón que turnoService.getByMes/getDisponibilidad:
  // el backend filtra server-side, sin profesional_id devuelve la cuenta entera.
  getDashboard: async (desde: string, hasta: string, profesionalId?: number): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/stats/dashboard', {
      params: { desde, hasta, ...(profesionalId ? { profesional_id: profesionalId } : {}) },
    });
    return data;
  },
};
