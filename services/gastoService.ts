import api from '@/lib/api';

// Set fijo validado server-side (`Rule::in(Gasto::CATEGORIAS)` en
// GastoController) — no hay enum backed ni tabla de lookup, ver
// app/Models/Gasto.php::CATEGORIAS en el repo de la API.
export const CATEGORIAS_GASTO = [
  'insumos',
  'alquiler',
  'servicios_publicos',
  'marketing',
  'otros',
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export interface Gasto {
  id: number;
  user_id: number;
  profesional_id: number | null;
  fecha: string; // "YYYY-MM-DD"
  // `decimal:2` cast en el modelo Laravel serializa a string en el JSON,
  // igual que Servicio.precio — nunca es number en la respuesta del backend.
  monto: string;
  categoria: CategoriaGasto;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGastoDto {
  fecha: string;
  monto: number;
  categoria: CategoriaGasto;
  descripcion?: string | null;
  profesional_id?: number | null;
}

// Todos los campos "sometimes" en el backend (misma regla que create,
// ver GastoController::rules). `descripcion`/`profesional_id` explícitos
// como `| null` (no solo omitidos) porque un `undefined` desaparece al
// serializar a JSON y el PUT saldría sin la clave — mismo criterio que
// UpdateServicioDto.precio en servicioService.ts.
export type UpdateGastoDto = Partial<CreateGastoDto>;

export const gastoService = {
  // `GastoController::index` no acepta query params — devuelve SIEMPRE
  // el listado completo de la cuenta, ordenado `fecha desc, id desc`.
  // No hay `desde`/`hasta` server-side pese a lo que el design.md original
  // asumía; cualquier scoping por mes se resuelve client-side (ver
  // useGastosDelMes en useGastoStore.ts).
  getAll: async (): Promise<Gasto[]> => {
    const { data } = await api.get<Gasto[]>('/gastos');
    return data;
  },

  getOne: async (id: number): Promise<Gasto> => {
    const { data } = await api.get<Gasto>(`/gastos/${id}`);
    return data;
  },

  create: async (dto: CreateGastoDto): Promise<Gasto> => {
    const { data } = await api.post<Gasto>('/gastos', dto);
    return data;
  },

  update: async (id: number, dto: UpdateGastoDto): Promise<Gasto> => {
    const { data } = await api.put<Gasto>(`/gastos/${id}`, dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/gastos/${id}`);
  },
};
