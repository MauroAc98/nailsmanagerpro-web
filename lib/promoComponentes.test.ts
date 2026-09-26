import { describe, expect, it } from 'vitest';
import {
  duracionDerivada, erroresGuardarComponentes, filaIncompleta, hayFilaIncompleta, moverFila,
  paraleloDisponible, precioAGuardar, precioInicialComponentes, problemasDeFila, sumaComponentes,
  type ComponenteDraft,
} from './promoComponentes';
import type { Servicio } from '@/services/servicioService';

const servicio = (over: Partial<Servicio>): Servicio => ({
  id: 1, user_id: 1, nombre: '', duracion_minutos: 0, precio: null, activo: true,
  es_promo: false, orden: 0, categoria_id: null, created_at: '', updated_at: '', ...over,
});
const softgel = servicio({ id: 1, duracion_minutos: 60, precio: '13000' });
const semis = servicio({ id: 2, duracion_minutos: 45, precio: '9000' });
const catalogo = [softgel, semis];

describe('promoComponentes — validación de filas', () => {
  it('filaIncompleta: true solo cuando un campo está elegido y el otro no', () => {
    expect(filaIncompleta({ servicioId: null, profesionalId: null })).toBe(false);
    expect(filaIncompleta({ servicioId: 1, profesionalId: 2 })).toBe(false);
    expect(filaIncompleta({ servicioId: 1, profesionalId: null })).toBe(true);
    expect(filaIncompleta({ servicioId: null, profesionalId: 2 })).toBe(true);
  });

  it('hayFilaIncompleta: true si alguna fila del draft está a medio completar', () => {
    const drafts: ComponenteDraft[] = [{ servicioId: 1, profesionalId: 1 }, { servicioId: 2, profesionalId: null }];
    expect(hayFilaIncompleta(drafts)).toBe(true);
    expect(hayFilaIncompleta([{ servicioId: 1, profesionalId: 1 }])).toBe(false);
  });
});

describe('promoComponentes — problemas por fila', () => {
  it('problemasDeFila: filtra por orden = index + 1, deja afuera los de orden null', () => {
    const problemas = [
      { orden: 1, mensaje: 'Laura está inactiva' },
      { orden: 2, mensaje: 'Servicio desvinculado' },
      { orden: null, mensaje: 'Sin inicios alineados' },
    ];
    expect(problemasDeFila(problemas, 0)).toEqual([{ orden: 1, mensaje: 'Laura está inactiva' }]);
    expect(problemasDeFila(problemas, 1)).toEqual([{ orden: 2, mensaje: 'Servicio desvinculado' }]);
    expect(problemasDeFila(problemas, 5)).toEqual([]);
  });
});

describe('promoComponentes — mapeo de errores 422 de PUT /componentes', () => {
  it('mapea componentes.{i}.servicio_id|profesional_id a la fila i (0-based)', () => {
    const e = { response: { data: { message: 'x', errors: {
      'componentes.0.servicio_id': ['Laura no ofrece Softgel'],
      'componentes.1.profesional_id': ['Profesional inválida'],
    } } } };
    expect(erroresGuardarComponentes(e)).toEqual({
      porFila: { 0: 'Laura no ofrece Softgel', 1: 'Profesional inválida' },
    });
  });

  it('mapea el código paralelo_no_habilitado a un hint de modo', () => {
    const e = { response: { data: { message: 'Activá "Atiende en paralelo" primero.', code: 'paralelo_no_habilitado' } } };
    expect(erroresGuardarComponentes(e)).toEqual({ porFila: {}, modoHint: 'Activá "Atiende en paralelo" primero.' });
  });

  it('cae a un mensaje general para cualquier otro error', () => {
    const e = { response: { data: { message: 'Servicio inválido' } } };
    expect(erroresGuardarComponentes(e)).toEqual({ porFila: {}, general: 'Servicio inválido' });
  });
});

describe('promoComponentes — modo paralelo gate', () => {
  it('paraleloDisponible: solo con el ajuste del salón activo y más de una profesional activa', () => {
    expect(paraleloDisponible(true, 2)).toBe(true);
    expect(paraleloDisponible(true, 1)).toBe(false);
    expect(paraleloDisponible(false, 2)).toBe(false);
    expect(paraleloDisponible(undefined, 2)).toBe(false);
  });
});

describe('promoComponentes — reordenar filas (secuencia)', () => {
  const drafts: ComponenteDraft[] = [
    { servicioId: 1, profesionalId: 1 }, { servicioId: 2, profesionalId: 2 }, { servicioId: 3, profesionalId: 3 },
  ];

  it('moverFila: sube/baja intercambiando posiciones, sin mutar el original', () => {
    expect(moverFila(drafts, 1, -1)).toEqual([drafts[1], drafts[0], drafts[2]]);
    expect(moverFila(drafts, 1, 1)).toEqual([drafts[0], drafts[2], drafts[1]]);
    expect(moverFila(drafts, 0, -1)).toEqual(drafts);
    expect(moverFila(drafts, 2, 1)).toEqual(drafts);
    expect(drafts).toEqual([{ servicioId: 1, profesionalId: 1 }, { servicioId: 2, profesionalId: 2 }, { servicioId: 3, profesionalId: 3 }]);
  });
});

describe('promoComponentes — duración y precio derivados', () => {
  const drafts: ComponenteDraft[] = [{ servicioId: 1, profesionalId: 1 }, { servicioId: 2, profesionalId: 2 }];

  it('duracionDerivada: paralelo = máximo, secuencia = suma, de las duraciones del catálogo', () => {
    expect(duracionDerivada('paralelo', drafts, catalogo)).toBe(60);
    expect(duracionDerivada('secuencia', drafts, catalogo)).toBe(105);
    expect(duracionDerivada('secuencia', [], catalogo)).toBe(0);
    expect(duracionDerivada('secuencia', [{ servicioId: null, profesionalId: null }], catalogo)).toBe(0);
  });

  it('sumaComponentes: suma los precios standalone del catálogo de las filas elegidas', () => {
    expect(sumaComponentes(drafts, catalogo)).toBe(22000);
    expect(sumaComponentes([{ servicioId: null, profesionalId: null }], catalogo)).toBe(0);
  });

  it('precioAGuardar: null si está vacío o igual a la suma; el número tipeado si difiere', () => {
    expect(precioAGuardar('', 22000)).toBeNull();
    expect(precioAGuardar('22000', 22000)).toBeNull();
    expect(precioAGuardar('18000', 22000)).toBe(18000);
  });

  it('precioInicialComponentes: vacío si el precio persistido coincide con la suma viva, si no el persistido', () => {
    expect(precioInicialComponentes({ precio: '22000', precio_componentes: 22000 })).toBe('');
    expect(precioInicialComponentes({ precio: '18000', precio_componentes: 22000 })).toBe('18000');
    expect(precioInicialComponentes({ precio: null, precio_componentes: null })).toBe('');
  });
});
