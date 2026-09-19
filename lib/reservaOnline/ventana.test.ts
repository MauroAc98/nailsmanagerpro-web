import { describe, expect, it } from 'vitest';
import { DIAS_VENTANA, diasReservables, primerDiaReservable, semanaDeFecha, ultimoDiaReservable } from './ventana';

// 2026-09-19 12:00 hora del salon (UTC-3), sabado.
const AHORA = Date.UTC(2026, 8, 19, 15, 0);

describe('ventana de reserva', () => {
  it('la ventana por defecto es de 30 dias hacia adelante', () => {
    expect(DIAS_VENTANA).toBe(30);
    expect(ultimoDiaReservable('2026-09-19')).toBe('2026-10-19');
  });

  it('primer dia reservable: hoy si la anticipacion no cruza la medianoche', () => {
    expect(primerDiaReservable(AHORA, 120)).toBe('2026-09-19');
  });

  it('primer dia reservable: manana si con la anticipacion ya es otro dia (22:30 + 2 h)', () => {
    expect(primerDiaReservable(Date.UTC(2026, 8, 20, 1, 30), 120)).toBe('2026-09-20');
  });

  it('semanaDeFecha devuelve lunes a domingo (2026-09-19 es sabado)', () => {
    const semana = semanaDeFecha('2026-09-19');
    expect(semana).toHaveLength(7);
    expect(semana[0]).toBe('2026-09-14');
    expect(semana[6]).toBe('2026-09-20');
    expect(semanaDeFecha('2026-09-14')[0]).toBe('2026-09-14');
    expect(semanaDeFecha('2026-09-20')[0]).toBe('2026-09-14');
  });

  it('diasReservables lista de primero a ultimo inclusive', () => {
    const dias = diasReservables('2026-09-19', '2026-09-22');
    expect(dias).toEqual(['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']);
  });
});
