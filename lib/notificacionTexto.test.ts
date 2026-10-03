import { describe, expect, it } from 'vitest';
import { claveTextoNotificacion } from './notificacionTexto';

describe('claveTextoNotificacion', () => {
  it('mantiene los textos de confirmacion y recordatorio', () => {
    expect(claveTextoNotificacion('confirmacion', 'delivered')).toBe('confirmacionEnviada');
    expect(claveTextoNotificacion('confirmacion', 'failed')).toBe('confirmacionFallida');
    expect(claveTextoNotificacion('recordatorio', 'manual')).toBe('recordatorioEnviado');
    expect(claveTextoNotificacion('recordatorio', 'failed')).toBe('recordatorioFallido');
  });

  it('una reprogramacion tiene su propio texto, no el de recordatorio', () => {
    expect(claveTextoNotificacion('reprogramacion', 'delivered')).toBe('reprogramacionEnviada');
    expect(claveTextoNotificacion('reprogramacion', 'failed')).toBe('reprogramacionFallida');
  });
});
