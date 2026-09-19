import { describe, expect, it } from 'vitest';
import { pasoMinimo, type FlowData } from './pasoMinimo';

const vacio: FlowData = {
  servicioIds: [],
  profesionalId: 'any',
  fecha: null,
  hora: null,
  cliente: { nombre: '', apellido: '', whatsapp: '' },
  reservaId: null,
};

const conServicios: FlowData = { ...vacio, servicioIds: [1] };
const conHorario: FlowData = { ...conServicios, fecha: '2026-09-25', hora: '10:00' };
const conDatos: FlowData = {
  ...conHorario,
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

  it('con horario pero sin datos, es datos', () => {
    expect(pasoMinimo(conHorario)).toBe('datos');
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
