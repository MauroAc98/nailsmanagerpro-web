import { describe, it, expect } from 'vitest';
import { sugerirHoras, opcionesHora, duracionLegible, aMinutos } from './sugerenciasHora';
import type { Slot } from '@/services/slotService';

const slot = (hora: string, activo = true): Slot => ({ id: 1, user_id: 1, hora, activo });
const slots = ['09:00', '10:00', '11:00', '12:00', '13:00'].map(h => slot(h));

describe('sugerirHoras', () => {
  it('ofrece los slots libres dentro del rango', () => {
    expect(sugerirHoras({ slots, ocupados: [], duracionMinutos: 60 }))
      .toEqual(['09:00', '10:00', '11:00', '12:00', '13:00']);
  });

  it('descarta los inicios que se pisan con un turno, considerando la duración', () => {
    const ocupados = [{ inicio: aMinutos('10:00'), fin: aMinutos('11:30') }];
    // 90 min: 09:00 terminaría 10:30 y pisa; 11:00 cae adentro; 11:30 (fin del turno) encaja.
    expect(sugerirHoras({ slots, ocupados, duracionMinutos: 90 })).toEqual(['11:30', '12:00', '13:00']);
  });

  it('sugiere el momento en que termina un turno aunque no sea un slot', () => {
    const ocupados = [{ inicio: aMinutos('09:00'), fin: aMinutos('09:45') }];
    expect(sugerirHoras({ slots, ocupados, duracionMinutos: 30 }).slice(0, 2)).toEqual(['09:45', '10:00']);
  });

  it('no sugiere fuera del rango ni antes de la hora actual', () => {
    const ocupados = [{ inicio: aMinutos('13:00'), fin: aMinutos('14:00') }];
    const r = sugerirHoras({ slots, ocupados, duracionMinutos: 30, desdeMinutos: aMinutos('11:15') });
    expect(r).toEqual(['12:00']);
  });

  it('opcionesHora marca como no libres los inicios que se pisan', () => {
    const ocupados = [{ inicio: aMinutos('10:00'), fin: aMinutos('11:30') }];
    const r = opcionesHora({ slots, ocupados, duracionMinutos: 90 });
    expect(r.filter(o => !o.libre).map(o => o.hora)).toEqual(['09:00', '10:00', '11:00']);
    expect(r.find(o => o.hora === '11:30')?.libre).toBe(true);
  });

  it('duracionLegible', () => {
    expect([30, 60, 90, 120].map(duracionLegible)).toEqual(['30 min', '1 h', '1 h 30', '2 h']);
  });

  it('ignora slots inactivos y devuelve vacío sin duración', () => {
    expect(sugerirHoras({ slots: [slot('09:00', false)], ocupados: [], duracionMinutos: 30 })).toEqual([]);
    expect(sugerirHoras({ slots, ocupados: [], duracionMinutos: 0 })).toEqual([]);
  });
});
