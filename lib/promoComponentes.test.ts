import { describe, expect, it } from 'vitest';
import {
  erroresGuardarComponentes, filaIncompleta, hayFilaIncompleta, problemasDeFila, type ComponenteDraft,
} from './promoComponentes';

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
