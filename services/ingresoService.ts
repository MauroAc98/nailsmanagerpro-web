import api from '@/lib/api';

// Set de fábrica de categorías de ingreso. Desde el PR "categorías
// personalizadas" el salón puede definir su propia lista
// (User.categorias_ingreso, editable por `PUT /perfil`); esta const es el
// fallback cuando esa lista no está cargada y la fuente de las labels
// traducidas (`category_<slug>`, ver `lib/categoriaLabel.ts`). El backend
// ya NO valida `Rule::in(...)`: `ingreso.categoria` es texto libre
// (1..40 chars). Espejo de CATEGORIAS_GASTO.
export const CATEGORIAS_INGRESO = [
  'venta_productos',
  'alquiler_espacio',
  'otros',
] as const;

// Union de las categorías de fábrica. `Ingreso.categoria` NO usa este tipo
// (es `string`: puede ser una categoría custom del salón) — se conserva
// solo para tipar el set de fábrica y sus labels.
export type CategoriaIngreso = (typeof CATEGORIAS_INGRESO)[number];

export interface Ingreso {
  id: number;
  user_id: number;
  fecha: string; // "YYYY-MM-DD"
  // `decimal:2` cast en el modelo Laravel serializa a string en el JSON,
  // igual que Servicio.precio / Gasto.monto — nunca es number en la
  // respuesta del backend.
  monto: string;
  // Texto libre (1..40 chars) — categoría de fábrica o custom del salón.
  categoria: string;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIngresoDto {
  fecha: string;
  monto: number;
  categoria: string;
  descripcion?: string | null;
}

// Todos los campos "sometimes" en el backend (misma regla que create,
// ver IngresoController::rules). `descripcion` explícita como `| null`
// (no solo omitida) porque un `undefined` desaparece al serializar a
// JSON y el PUT saldría sin la clave — mismo criterio que
// UpdateGastoDto.descripcion en gastoService.ts.
export type UpdateIngresoDto = Partial<CreateIngresoDto>;

export interface RangoFechas {
  desde?: string; // "YYYY-MM-DD"
  hasta?: string; // "YYYY-MM-DD"
}

export const ingresoService = {
  // `desde`/`hasta` opcionales e independientes (`IngresoController::index`,
  // ambos inclusive vía whereBetween). Sin params devuelve el listado
  // completo de la cuenta, ordenado `fecha desc, id desc` — mismo
  // comportamiento y contrato que `/gastos`.
  getAll: async (rango?: RangoFechas): Promise<Ingreso[]> => {
    const { data } = await api.get<Ingreso[]>('/ingresos', { params: rango });
    return data;
  },

  getOne: async (id: number): Promise<Ingreso> => {
    const { data } = await api.get<Ingreso>(`/ingresos/${id}`);
    return data;
  },

  create: async (dto: CreateIngresoDto): Promise<Ingreso> => {
    const { data } = await api.post<Ingreso>('/ingresos', dto);
    return data;
  },

  update: async (id: number, dto: UpdateIngresoDto): Promise<Ingreso> => {
    const { data } = await api.put<Ingreso>(`/ingresos/${id}`, dto);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/ingresos/${id}`);
  },
};
