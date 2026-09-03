import api from '@/lib/api';

// Set de fábrica de categorías de gasto. Desde el PR "categorías
// personalizadas" el salón puede definir su propia lista (User.categorias_gasto,
// editable por `PUT /perfil`); esta const es el fallback cuando esa lista no
// está cargada y la fuente de las labels traducidas (`category_<slug>`, ver
// `lib/categoriaLabel.ts`). El backend ya NO valida `Rule::in(...)`:
// `gasto.categoria` es texto libre (1..40 chars).
export const CATEGORIAS_GASTO = [
  'insumos',
  'alquiler',
  'servicios_publicos',
  'marketing',
  'otros',
] as const;

// Union de las categorías de fábrica. `Gasto.categoria` NO usa este tipo
// (es `string`: puede ser una categoría custom del salón) — se conserva
// solo para tipar el set de fábrica y sus labels.
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export interface Gasto {
  id: number;
  user_id: number;
  profesional_id: number | null;
  fecha: string; // "YYYY-MM-DD"
  // `decimal:2` cast en el modelo Laravel serializa a string en el JSON,
  // igual que Servicio.precio — nunca es number en la respuesta del backend.
  monto: string;
  // Texto libre (1..40 chars) — categoría de fábrica o custom del salón.
  categoria: string;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGastoDto {
  fecha: string;
  monto: number;
  categoria: string;
  descripcion?: string | null;
  profesional_id?: number | null;
}

// Todos los campos "sometimes" en el backend (misma regla que create,
// ver GastoController::rules). `descripcion`/`profesional_id` explícitos
// como `| null` (no solo omitidos) porque un `undefined` desaparece al
// serializar a JSON y el PUT saldría sin la clave — mismo criterio que
// UpdateServicioDto.precio en servicioService.ts.
export type UpdateGastoDto = Partial<CreateGastoDto>;

export interface RangoFechas {
  desde?: string; // "YYYY-MM-DD"
  hasta?: string; // "YYYY-MM-DD"
}

export const gastoService = {
  // `desde`/`hasta` opcionales e independientes (`GastoController::index`,
  // ambos inclusive vía whereBetween). Sin params devuelve el listado
  // completo de la cuenta, ordenado `fecha desc, id desc` — mismo
  // comportamiento que antes de que el filtro existiera.
  getAll: async (rango?: RangoFechas): Promise<Gasto[]> => {
    const { data } = await api.get<Gasto[]>('/gastos', { params: rango });
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
