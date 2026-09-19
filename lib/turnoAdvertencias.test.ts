import { describe, expect, it } from 'vitest';
import { advertenciaTurno } from './turnoAdvertencias';
import type { Profesional } from '@/services/profesionalService';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';

function buildProfesional(overrides: Partial<Profesional> = {}): Profesional {
  return {
    id: 1, user_id: 1, nombre: 'Natalia', apellido: null, nombre_completo: 'Natalia',
    color: null, activo: true, servicios: [], fondo_historia_url: null, avatar_url: null,
    historia_precios_template_id: null, historia_precios_fotos: [], historia_precios_nota: null,
    dias_atencion: null,
    ...overrides,
  };
}

function buildBloqueo(overrides: Partial<BloqueoAgenda> = {}): BloqueoAgenda {
  return {
    id: 1, user_id: 1, profesional_id: null, fecha: '2099-01-04',
    hora_desde: null, hora_hasta: null, motivo: null,
    created_at: '', updated_at: '',
    ...overrides,
  };
}

// 2099-01-04 es domingo, 2099-01-05 es lunes (calendario real) — fechas
// fijas y lejanas para no depender del reloj del entorno de test.
describe('advertenciaTurno', () => {
  it('no devuelve aviso en un día laborable normal, sin bloqueos', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-05', hora: '10:00', duracionMinutos: 30,
      profesional: buildProfesional({ dias_atencion: [1, 2, 3, 4, 5] }),
      bloqueos: [],
    });
    expect(resultado).toBeNull();
  });

  it('avisa cuando el día de la semana no está en dias_atencion de la profesional', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-04', hora: '10:00', duracionMinutos: 30, // domingo, fuera de [1..5]
      profesional: buildProfesional({ nombre: 'Natalia', dias_atencion: [1, 2, 3, 4, 5] }),
      bloqueos: [],
    });
    expect(resultado).toContain('Natalia');
  });

  it('avisa por un bloqueo de día completo que aplica a la profesional elegida', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-05', hora: '10:00', duracionMinutos: 30,
      profesional: buildProfesional({ id: 7, dias_atencion: null }),
      bloqueos: [buildBloqueo({ profesional_id: 7, fecha: '2099-01-05', motivo: 'Vacaciones' })],
    });
    expect(resultado).toContain('Vacaciones');
  });

  it('avisa por un bloqueo de día completo salon-wide (profesional_id null) aunque la profesional no esté restringida', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-05', hora: '10:00', duracionMinutos: 30,
      profesional: buildProfesional({ id: 7, dias_atencion: null }),
      bloqueos: [buildBloqueo({ profesional_id: null, fecha: '2099-01-05' })],
    });
    expect(resultado).not.toBeNull();
  });

  it('avisa por un bloqueo parcial cuyo rango se solapa con la duración del turno', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-05', hora: '13:30', duracionMinutos: 60, // 13:30-14:30, bloqueo 13:00-18:00
      profesional: buildProfesional({ id: 7, dias_atencion: null }),
      bloqueos: [buildBloqueo({ profesional_id: 7, fecha: '2099-01-05', hora_desde: '13:00', hora_hasta: '18:00' })],
    });
    expect(resultado).not.toBeNull();
  });

  it('NO avisa cuando el bloqueo parcial no se solapa con la duración del turno', () => {
    const resultado = advertenciaTurno({
      fecha: '2099-01-05', hora: '09:00', duracionMinutos: 30, // 09:00-09:30, bloqueo 13:00-18:00
      profesional: buildProfesional({ id: 7, dias_atencion: null }),
      bloqueos: [buildBloqueo({ profesional_id: 7, fecha: '2099-01-05', hora_desde: '13:00', hora_hasta: '18:00' })],
    });
    expect(resultado).toBeNull();
  });
});
