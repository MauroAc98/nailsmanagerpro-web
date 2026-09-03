import { describe, expect, it } from 'vitest';
import {
  filtrarIngresos,
  contarFiltrosActivos,
  FILTROS_INGRESO_VACIOS,
  type FiltrosIngreso,
} from './filtrarIngresos';
import type { Ingreso } from '@/services/ingresoService';

// Filtrado client-side sobre el mes ya cargado en el store (GET
// /ingresos?desde&hasta). El backend no filtra por categoría/texto —
// todo esto corre en memoria, ver configuracion/ingresos/page.tsx.
// A diferencia de gastos, un ingreso NO tiene profesional_id, así que
// esta dimensión no existe acá.

function ingreso(over: Partial<Ingreso>): Ingreso {
  return {
    id: 1,
    user_id: 1,
    fecha: '2026-09-10',
    monto: '1000.00',
    categoria: 'venta_productos',
    descripcion: null,
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    ...over,
  };
}

const base: Ingreso[] = [
  ingreso({ id: 1, categoria: 'venta_productos', descripcion: 'Esmaltes Semilac revendidos', fecha: '2026-09-03' }),
  ingreso({ id: 2, categoria: 'alquiler_espacio', descripcion: 'Alquiler sillón septiembre', fecha: '2026-09-01' }),
  ingreso({ id: 3, categoria: 'otros', descripcion: 'Propina evento', fecha: '2026-09-20' }),
  ingreso({ id: 4, categoria: 'venta_productos', descripcion: 'Kit de algodón y quitaesmalte', fecha: '2026-09-28' }),
];

const con = (over: Partial<FiltrosIngreso>): FiltrosIngreso => ({ ...FILTROS_INGRESO_VACIOS, ...over });

describe('filtrarIngresos', () => {
  it('sin filtros devuelve la lista intacta', () => {
    expect(filtrarIngresos(base, FILTROS_INGRESO_VACIOS)).toEqual(base);
  });

  it('filtra por categoría', () => {
    expect(filtrarIngresos(base, con({ categoria: 'venta_productos' })).map(i => i.id)).toEqual([1, 4]);
  });

  it('filtra por texto en la descripción, ignorando mayúsculas y acentos', () => {
    expect(filtrarIngresos(base, con({ texto: 'algodon' })).map(i => i.id)).toEqual([4]);
    expect(filtrarIngresos(base, con({ texto: 'PROPINA' })).map(i => i.id)).toEqual([3]);
  });

  it('un ingreso sin descripción nunca matchea un filtro de texto', () => {
    const sinDesc = [ingreso({ id: 9, descripcion: null })];
    expect(filtrarIngresos(sinDesc, con({ texto: 'algo' }))).toEqual([]);
  });

  it('filtra por rango de fecha inclusivo, con desde y hasta independientes', () => {
    expect(filtrarIngresos(base, con({ desde: '2026-09-03' })).map(i => i.id)).toEqual([1, 3, 4]);
    expect(filtrarIngresos(base, con({ hasta: '2026-09-03' })).map(i => i.id)).toEqual([1, 2]);
    expect(filtrarIngresos(base, con({ desde: '2026-09-02', hasta: '2026-09-21' })).map(i => i.id)).toEqual([1, 3]);
  });

  it('combina todos los filtros con AND', () => {
    const r = filtrarIngresos(base, con({ categoria: 'venta_productos', desde: '2026-09-10' }));
    expect(r.map(i => i.id)).toEqual([4]);
  });
});

describe('contarFiltrosActivos', () => {
  it('cuenta 0 con los filtros vacíos', () => {
    expect(contarFiltrosActivos(FILTROS_INGRESO_VACIOS)).toBe(0);
  });

  it('texto en blanco no cuenta como filtro activo', () => {
    expect(contarFiltrosActivos(con({ texto: '   ' }))).toBe(0);
  });

  it('desde y hasta juntos cuentan como un solo filtro', () => {
    expect(contarFiltrosActivos(con({ desde: '2026-09-01', hasta: '2026-09-30' }))).toBe(1);
  });

  it('suma un punto por cada dimensión activa', () => {
    expect(contarFiltrosActivos(con({ categoria: 'otros', texto: 'x', desde: '2026-09-01' }))).toBe(3);
  });
});
