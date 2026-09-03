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
  // Ambos campos son additive keys en `StatsController::dashboard()` (ver
  // Phase 2 de gastos-module) — un build de frontend desplegado antes de
  // que la API los sirva recibe la respuesta sin estas claves, por eso los
  // consumidores deben usar `stats?.gastos ?? 0` / `stats?.ganancia_neta ??
  // stats?.ganancias ?? 0` en vez de asumirlas siempre presentes.
  gastos: number;
  ganancia_neta: number;
  // Desglose de ingresos servido por `StatsController::dashboard()` a partir
  // de PR1 del módulo de Ingresos — opcionales por el mismo motivo que
  // `gastos`/`ganancia_neta`: un build de frontend desplegado antes de que
  // la API los sirva recibe la respuesta sin estas claves. Los consumidores
  // deben usar `stats?.ingresos_agenda ?? 0`, etc. `ingresos_agenda` es lo
  // facturado por turnos; `ingresos_otros` es la suma de los ingresos
  // cargados a mano en Configuración → Ingresos.
  ingresos_agenda?: number;
  ingresos_otros?: number;
  ingresos_otros_por_categoria?: { categoria: string; monto: number }[];
  ganancias_por_servicio: GananciaPorServicio[];
  ganancias_por_dia: GananciaPorDia[];
  // dia_semana en formato ISO (1 = lunes ... 7 = domingo) — siempre 7
  // entradas, incluso en 0, para poder dibujar un eje fijo sin rellenar
  // huecos del lado del frontend.
  turnos_por_estado_por_dia_semana: {
    dia_semana: number;
    completados: number;
    confirmados: number;
    cancelados: number;
  }[];
}

export interface BucketOcupacion {
  dia_semana: number; // ISO: 1 = lunes ... 7 = domingo
  hora: number; // 0-23
  cantidad: number;
}

export interface PuntoGanancia {
  fecha: string; // "YYYY-MM-DD" — inicio del bucket (lunes de la semana / día 1 del mes)
  monto: number;
  // false si el rango elegido no cubre la semana/mes calendario completa de
  // este bucket (ej. elegiste "25/7 al 31/7" — el bucket de julio queda
  // parcial, monto solo refleja esos días, no el mes entero).
  completo: boolean;
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

  // Lista rala — solo combinaciones día×hora con al menos un turno
  // (confirmado/completado; cancelado no cuenta como ocupación real). El
  // caller rellena con 0 los huecos, mismo criterio que ganancias_por_dia.
  getOcupacion: async (desde: string, hasta: string, profesionalId?: number): Promise<BucketOcupacion[]> => {
    const { data } = await api.get<BucketOcupacion[]>('/stats/ocupacion', {
      params: { desde, hasta, ...(profesionalId ? { profesional_id: profesionalId } : {}) },
    });
    return data;
  },
};
