import { describe, expect, it } from 'vitest';
import { pasoMinimo, type FlowData } from './pasoMinimo';

const vacio: FlowData = {
  servicioIds: [],
  profesionalId: 'any',
  fecha: null,
  hora: null,
  cliente: { nombre: '', apellido: '', whatsapp: '' },
  hold: null,
  nota: '',
};

const conServicios: FlowData = { ...vacio, servicioIds: [1] };
const conHorario: FlowData = { ...conServicios, fecha: '2026-09-25', hora: '10:00' };
const HOLD = { reservaId: 'mock-1', expiraMs: 1_000, profesionalId: 1 };
const conHold: FlowData = { ...conHorario, hold: HOLD };
const conDatos: FlowData = {
  ...conHold,
  cliente: { nombre: 'Ana', apellido: 'Perez', whatsapp: '+5491155551234' },
};

describe('pasoMinimo', () => {
  it('sin nada elegido, el paso minimo es servicios', () => {
    expect(pasoMinimo(vacio)).toBe('servicios');
  });

  it('con servicios pero sin horario, es horario', () => {
    expect(pasoMinimo(conServicios)).toBe('horario');
  });

  it('con fecha pero sin hora sigue en horario', () => {
    expect(pasoMinimo({ ...conServicios, fecha: '2026-09-25' })).toBe('horario');
  });

  it('con horario elegido pero sin haberlo retenido todavia, hay que volver a horario', () => {
    expect(pasoMinimo(conHorario)).toBe('horario');
  });

  it('con el horario retenido pero sin datos, es datos', () => {
    expect(pasoMinimo(conHold)).toBe('datos');
  });

  it('un hold vencido NO redirige: la pantalla muestra "Se liberó tu horario" (el guard solo mira si hubo hold)', () => {
    expect(pasoMinimo({ ...conDatos, hold: { ...HOLD, expiraMs: 0 } })).toBe('resumen');
  });

  it('un whatsapp invalido deja el paso en datos', () => {
    expect(pasoMinimo({ ...conDatos, cliente: { ...conDatos.cliente, whatsapp: '1155' } })).toBe(
      'datos',
    );
  });

  it('con todo completo, es resumen', () => {
    expect(pasoMinimo(conDatos)).toBe('resumen');
  });

  it('nombre o apellido en blanco dejan el paso en datos', () => {
    expect(pasoMinimo({ ...conDatos, cliente: { ...conDatos.cliente, nombre: '  ' } })).toBe('datos');
    expect(pasoMinimo({ ...conDatos, cliente: { ...conDatos.cliente, apellido: '' } })).toBe('datos');
  });
});
