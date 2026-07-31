import api from '@/lib/api';

export interface ServicioMasPedido {
  servicio_id: number;
  nombre: string;
  cantidad: number;
}

export interface GananciaPorServicio {
  servicio_id: number;
  nombre: string;
  monto: number;
}

export interface GananciaPorDia {
  fecha: string; // "YYYY-MM-DD"
  monto: number;
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
  ganancias: number;
  ganancias_por_servicio: GananciaPorServicio[];
  ganancias_por_dia: GananciaPorDia[];
}

export interface PuntoGanancia {
  fecha: string; // "YYYY-MM-DD" — inicio del bucket (lunes de la semana / día 1 del mes)
  monto: number;
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

  // Independiente del rango del dashboard a propósito — siempre trae los
  // últimos 12 buckets terminando hoy, sin importar qué mes esté navegando
  // el resto de la pantalla.
  getGananciasPorPeriodo: async (
    granularidad: 'semana' | 'mes',
    profesionalId?: number
  ): Promise<PuntoGanancia[]> => {
    const { data } = await api.get<{ puntos: PuntoGanancia[] }>('/stats/ganancias-por-periodo', {
      params: { granularidad, ...(profesionalId ? { profesional_id: profesionalId } : {}) },
    });
    return data.puntos;
  },
};
