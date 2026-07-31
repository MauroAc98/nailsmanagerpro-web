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

  // Con `rango` (modo "Rango personalizado" de la pantalla): bucketiza
  // exactamente ese desde/hasta. Sin `rango` (modo "Mes" normal, que no
  // aplica acá): últimos 12 buckets terminando hoy — vistazo de tendencia
  // reciente sin importar qué mes calendario se esté navegando.
  getGananciasPorPeriodo: async (
    granularidad: 'semana' | 'mes',
    profesionalId?: number,
    rango?: { desde: string; hasta: string }
  ): Promise<{ puntos: PuntoGanancia[]; truncado: boolean }> => {
    const { data } = await api.get<{ puntos: PuntoGanancia[]; truncado: boolean }>('/stats/ganancias-por-periodo', {
      params: {
        granularidad,
        ...(profesionalId ? { profesional_id: profesionalId } : {}),
        ...(rango ? { desde: rango.desde, hasta: rango.hasta } : {}),
      },
    });
    return data;
  },
};
