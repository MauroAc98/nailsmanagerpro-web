import { describe, expect, it } from 'vitest';
import { asignacionesDe, asignacionesAWire } from './asignaciones';

describe('asignacionesDe', () => {
  it('una consulta de una sola profesional es UN grupo con todos los servicios (flujo de siempre)', () => {
    expect(asignacionesDe({ servicioIds: [7, 9], profesionalId: 3 })).toEqual([{ servicioIds: [7, 9], profesionalId: 3 }]);
  });

  it('"Cualquiera" es un grupo sin profesional', () => {
    expect(asignacionesDe({ servicioIds: [7] })).toEqual([{ servicioIds: [7], profesionalId: undefined }]);
  });

  it('si trae asignaciones propias, esas mandan y mantienen el orden', () => {
    const grupos = [
      { servicioIds: [9], profesionalId: 4 },
      { servicioIds: [7], profesionalId: 3 },
    ];
    expect(asignacionesDe({ servicioIds: [7, 9], asignaciones: grupos })).toBe(grupos);
  });
});

describe('asignacionesAWire', () => {
  it('serializa snake_case y omite profesional_id cuando es "Cualquiera"', () => {
    expect(
      asignacionesAWire([
        { servicioIds: [7], profesionalId: undefined },
        { servicioIds: [9], profesionalId: 4 },
      ]),
    ).toEqual([{ servicio_ids: [7] }, { servicio_ids: [9], profesional_id: 4 }]);
  });
});
