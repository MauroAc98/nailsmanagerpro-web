import { describe, expect, it } from 'vitest';
import {
  filtrarGastos,
  contarFiltrosActivos,
  FILTROS_GASTO_VACIOS,
  type FiltrosGasto,
} from './filtrarGastos';
import type { Gasto } from '@/services/gastoService';

// Filtrado client-side sobre el mes ya cargado en el store (GET
// /gastos?desde&hasta). El backend no filtra por categoría/texto/profesional
// — todo esto corre en memoria, ver configuracion/gastos/page.tsx.

function gasto(over: Partial<Gasto>): Gasto {
  return {
    id: 1,
    user_id: 1,
    profesional_id: null,
    fecha: '2026-09-10',
    monto: '1000.00',
    categoria: 'insumos',
    descripcion: null,
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    ...over,
  };
}

const base: Gasto[] = [
  gasto({ id: 1, categoria: 'insumos', descripcion: 'Esmaltes Semilac', fecha: '2026-09-03', profesional_id: 7 }),
  gasto({ id: 2, categoria: 'alquiler', descripcion: 'Alquiler local septiembre', fecha: '2026-09-01', profesional_id: null }),
  gasto({ id: 3, categoria: 'marketing', descripcion: 'Pauta Instagram', fecha: '2026-09-20', profesional_id: 7 }),
  gasto({ id: 4, categoria: 'insumos', descripcion: 'Algodón y quitaesmalte', fecha: '2026-09-28', profesional_id: 3 }),
];

const con = (over: Partial<FiltrosGasto>): FiltrosGasto => ({ ...FILTROS_GASTO_VACIOS, ...over });

describe('filtrarGastos', () => {
  it('sin filtros devuelve la lista intacta', () => {
    expect(filtrarGastos(base, FILTROS_GASTO_VACIOS)).toEqual(base);
  });

  it('filtra por categoría', () => {
    expect(filtrarGastos(base, con({ categoria: 'insumos' })).map(g => g.id)).toEqual([1, 4]);
  });

  it('filtra por texto en la descripción, ignorando mayúsculas y acentos', () => {
    expect(filtrarGastos(base, con({ texto: 'algodon' })).map(g => g.id)).toEqual([4]);
    expect(filtrarGastos(base, con({ texto: 'INSTAGRAM' })).map(g => g.id)).toEqual([3]);
  });

  it('un gasto sin descripción nunca matchea un filtro de texto', () => {
    const sinDesc = [gasto({ id: 9, descripcion: null })];
    expect(filtrarGastos(sinDesc, con({ texto: 'algo' }))).toEqual([]);
  });

  it('filtra por profesional (incluye el caso sin profesional)', () => {
    expect(filtrarGastos(base, con({ profesionalId: 7 })).map(g => g.id)).toEqual([1, 3]);
  });

  it('filtra por rango de fecha inclusivo, con desde y hasta independientes', () => {
    expect(filtrarGastos(base, con({ desde: '2026-09-03' })).map(g => g.id)).toEqual([1, 3, 4]);
    expect(filtrarGastos(base, con({ hasta: '2026-09-03' })).map(g => g.id)).toEqual([1, 2]);
    expect(filtrarGastos(base, con({ desde: '2026-09-02', hasta: '2026-09-21' })).map(g => g.id)).toEqual([1, 3]);
  });

  it('combina todos los filtros con AND', () => {
    const r = filtrarGastos(base, con({ categoria: 'insumos', profesionalId: 7, desde: '2026-09-01' }));
    expect(r.map(g => g.id)).toEqual([1]);
  });
});

describe('contarFiltrosActivos', () => {
  it('cuenta 0 con los filtros vacíos', () => {
    expect(contarFiltrosActivos(FILTROS_GASTO_VACIOS)).toBe(0);
  });

  it('texto en blanco no cuenta como filtro activo', () => {
    expect(contarFiltrosActivos(con({ texto: '   ' }))).toBe(0);
  });

  it('desde y hasta juntos cuentan como un solo filtro', () => {
    expect(contarFiltrosActivos(con({ desde: '2026-09-01', hasta: '2026-09-30' }))).toBe(1);
  });

  it('suma un punto por cada dimensión activa', () => {
    expect(contarFiltrosActivos(con({ categoria: 'otros', texto: 'x', profesionalId: 2, desde: '2026-09-01' }))).toBe(4);
  });
});
