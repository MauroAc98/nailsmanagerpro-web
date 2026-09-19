import type { AxiosInstance } from 'axios';
import { getDeviceToken } from '../deviceToken';
import type { ReservaOnlineWrites } from '../service';
import type {
  DatosReserva,
  ReservationCreated,
  ReservationStatus,
  ReservationStatusValue,
  Retencion,
  RetenerInput,
} from '../types';
import { traducirErrorHttp } from './errores';

// Adapter real de las 5 escrituras de la reserva online (slice 3):
// hold -> datos -> pago -> estado / liberar, contra
// /api/public/{slug}/reservas/*. El resto de ReservaOnlineWrites (ajustes,
// Mercado Pago, fotos, listado) todavia no tiene backend: sigue en el mock
// (composicion en index.ts).
export type ReservaOnlineWritesReales = Pick<
  ReservaOnlineWrites,
  'retenerHorario' | 'actualizarDatosReserva' | 'iniciarPago' | 'liberarHold' | 'getReservationStatus'
>;

interface HoldDto {
  token: string;
  estado: string;
  expira_en_ms: number;
  profesional_id: number;
  fecha: string;
  hora: string;
  duracion_total_minutos: number;
}
interface BasicoDto {
  token: string;
  estado: string;
  expira_en_ms: number;
  checkout_url?: string;
}
interface EstadoDto extends BasicoDto {
  resumen: {
    servicio_ids: number[];
    profesional_id: number;
    fecha: string;
    hora: string;
    duracion_total_minutos: number;
    deposito: number;
    nota: string | null;
  };
}

function nuevaIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `ro-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// held y pending_payment se muestran igual del lado de la clienta (design
// FE mapping, decision D5): un hold vivo todavia no tiene checkout_url, pero
// la pantalla de estado los trata igual (pendiente de pago). `cancelled`
// queda distinto de `expired` (la UI tiene una pantalla propia para cada uno).
function aEstadoPublico(estado: string): ReservationStatusValue {
  if (estado === 'held' || estado === 'pending_payment') return 'pending_payment';
  if (estado === 'confirmed' || estado === 'cancelled') return estado;
  return 'expired';
}

export interface RealWritesOptions {
  deviceToken?: () => string;
  newIdempotencyKey?: () => string;
}

export function createRealWrites(http: AxiosInstance, opts: RealWritesOptions = {}): ReservaOnlineWritesReales {
  const deviceToken = opts.deviceToken ?? (() => getDeviceToken());
  const generarKey = opts.newIdempotencyKey ?? nuevaIdempotencyKey;

  // Reintento del MISMO pick (servicios/profesional/fecha/hora) antes de que
  // el hold se confirme reusa la Idempotency-Key, para que el replay
  // idempotente del backend responda con la reserva ya creada en vez de
  // fallar con slot_taken; un pick distinto genera una key nueva (decision A4).
  let ultimoIntento: { firma: string; key: string } | null = null;
  const idempotencyKeyPara = (slug: string, input: RetenerInput): string => {
    const firma = JSON.stringify([slug, input.servicioIds, input.profesionalId ?? null, input.fecha, input.hora]);
    if (ultimoIntento?.firma === firma) return ultimoIntento.key;
    const key = generarKey();
    ultimoIntento = { firma, key };
    return key;
  };

  const base = (slug: string) => `/public/${encodeURIComponent(slug)}/reservas`;
  const headers = () => ({ 'X-Device-Token': deviceToken() });

  async function pedir<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      return (await fn()).data;
    } catch (err) {
      throw traducirErrorHttp(err);
    }
  }

  return {
    async retenerHorario(slug, input): Promise<Retencion> {
      const key = idempotencyKeyPara(slug, input);
      const data = await pedir(() =>
        http.post<HoldDto>(
          `${base(slug)}/holds`,
          {
            servicio_ids: input.servicioIds,
            profesional_id: input.profesionalId,
            fecha: input.fecha,
            hora: input.hora,
          },
          { headers: { ...headers(), 'Idempotency-Key': key } },
        ),
      );
      return { reservaId: data.token, expiresAtMs: data.expira_en_ms, profesionalId: data.profesional_id };
    },

    async actualizarDatosReserva(slug, reservaId, datos: DatosReserva): Promise<void> {
      await pedir(() =>
        http.put<BasicoDto>(
          `${base(slug)}/${reservaId}/datos`,
          {
            nombre: datos.cliente.nombre,
            apellido: datos.cliente.apellido,
            whatsapp: datos.cliente.whatsapp,
            nota: datos.nota,
          },
          { headers: headers() },
        ),
      );
    },

    async iniciarPago(slug, reservaId): Promise<ReservationCreated> {
      const data = await pedir(() =>
        http.post<BasicoDto>(`${base(slug)}/${reservaId}/pago`, undefined, { headers: headers() }),
      );
      return {
        id: data.token,
        status: 'pending_payment',
        expiresAtMs: data.expira_en_ms,
        checkoutUrl: data.checkout_url ?? '',
      };
    },

    async liberarHold(slug, reservaId): Promise<void> {
      await pedir(() => http.delete(`${base(slug)}/${reservaId}`, { headers: headers() }));
    },

    async getReservationStatus(slug, id): Promise<ReservationStatus> {
      const data = await pedir(() => http.get<EstadoDto>(`${base(slug)}/${id}`, { headers: headers() }));
      return {
        id: data.token,
        status: aEstadoPublico(data.estado),
        expiresAtMs: data.expira_en_ms,
        checkoutUrl: data.checkout_url,
        summary: {
          servicioIds: data.resumen.servicio_ids,
          profesionalId: data.resumen.profesional_id,
          fecha: data.resumen.fecha,
          hora: data.resumen.hora,
          deposito: data.resumen.deposito,
          duracionTotalMinutos: data.resumen.duracion_total_minutos,
          nota: data.resumen.nota ?? undefined,
        },
      };
    },
  };
}
