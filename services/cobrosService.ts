import api from '@/lib/api';
import type { Turno } from '@/services/turnoService';
import type { EstadoPago, PagoFiltro, PeriodoFiltro, TurnoFiltro } from '@/lib/cobros';

// Cobro de un turno, calculado por el backend (App\Services\Cobros\CobrosCalculator).
// Dinero en pesos: enteros cuando no hay centavos.
export interface CobroTurno {
  finalizado: boolean;
  pago: EstadoPago;
  // Confirmados: estimado a precio de lista (null si algún servicio no tiene).
  // Finalizados: lo registrado en los servicios (null si falta algún precio).
  precio: number | null;
  // Solo finalizados con todos los precios cargados.
  cobrado: number | null;
  // Seña online PAGADA (estado 'aprobado'), 0 si no hay.
  sena: number;
  // La seña es de la reserva y la comparten varios turnos: no hay "falta" por fila.
  sena_compartida: boolean;
  falta_fila: number | null;
  // Suma de los servicios que tienen precio de lista, y si TODOS lo tienen.
  precio_lista: number;
  lista_completa: boolean;
}

export type TurnoConCobro = Turno & { cobro: CobroTurno };

export interface CobrosResumen {
  sena_cobrada: number;
  cobrado_finalizados: number;
  falta_cobrar: number;
  sin_precio_count: number;
  sin_precio_estimado: number;
  // Señas de reservas sin ningún turno finalizado.
  sena_en_pendientes: number;
  // "Ya cobraste": cobrado en finalizados + sena_en_pendientes.
  cobrado_total: number;
}

export interface CobrosListaBulk {
  count: number;
  total: number;
  items: { turno_id: number; precios: { servicio_id: number; precio: number }[] }[];
}

export interface CobrosPagina {
  data: TurnoConCobro[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  // Por estado de pago; ignora el filtro de pago elegido, respeta los demás.
  counts: Record<PagoFiltro, number>;
  resumen: CobrosResumen;
  lista_bulk: CobrosListaBulk;
}

export interface CobrosQuery {
  page: number;
  per_page: number;
  turno: TurnoFiltro;
  pago: PagoFiltro;
  periodo: PeriodoFiltro;
  buscar?: string;
  desde: string;
  hasta: string;
  // El día de quien usa la app: el servidor no decide qué es "hoy".
  hoy: string;
}

export const cobrosService = {
  listar: async (query: CobrosQuery): Promise<CobrosPagina> => {
    const { data } = await api.get<CobrosPagina>('/cobros', { params: query });
    return data;
  },
};
