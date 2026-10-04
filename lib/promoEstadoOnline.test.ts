import { describe, expect, it } from 'vitest';
import { estadoReservaOnline } from './promoEstadoOnline';
import type { ProblemaPromo, Servicio } from '@/services/servicioService';
import type { Profesional } from '@/services/profesionalService';

const prof = (id: number, nombre: string) => ({ id, nombre } as Profesional);
const serv = (id: number, nombre: string) => ({ id, nombre } as Servicio);
const profesionales = [prof(1, 'Ana'), prof(2, 'Laura')];
const servicios = [serv(1, 'Softgel'), serv(2, 'Semis pies')];
const componentes = [{ servicioId: 1, profesionalId: 1 }, { servicioId: 2, profesionalId: 2 }];
const base = { componentes, profesionales, servicios, problemas: [] as ProblemaPromo[], alineacion: { inicios_validos: ['10:00'], descartados: [] } };
const problema = (over: Partial<ProblemaPromo>): ProblemaPromo =>
  ({ codigo: 'profesional_inactiva', orden: 2, profesional_id: 2, servicio_id: 2, mensaje: 'texto del backend', ...over });

describe('estadoReservaOnline', () => {
  it('is null for a promo without saved components', () => {
    expect(estadoReservaOnline({ ...base, componentes: [] })).toBeNull();
  });

  it('ok when there are valid starts and no problems, naming each person once', () => {
    expect(estadoReservaOnline(base)).toEqual({ tipo: 'ok', nombres: ['Ana', 'Laura'] });
  });

  it('pendiente with a plain example from the first discarded start', () => {
    const alineacion = {
      inicios_validos: [],
      descartados: [{ hora_inicio: '10:00', profesional_id: 2, profesional_nombre: 'Laura', hora_requerida: '10:45', mensaje: 'x' }],
    };
    expect(estadoReservaOnline({ ...base, alineacion })).toEqual({
      tipo: 'pendiente', ejemplo: { a: 'Ana', hora: '10:00', b: 'Laura', requerida: '10:45' },
    });
  });

  it('pendiente without example when the backend only flags sin_inicios_alineados', () => {
    const problemas = [problema({ codigo: 'sin_inicios_alineados', orden: null, profesional_id: null, servicio_id: null })];
    expect(estadoReservaOnline({ ...base, problemas, alineacion: { inicios_validos: [], descartados: [] } }))
      .toEqual({ tipo: 'pendiente' });
  });

  it('bloqueo for an inactive person, built from ids and never from the backend text', () => {
    expect(estadoReservaOnline({ ...base, problemas: [problema({})] })).toEqual({
      tipo: 'bloqueo', motivo: 'inactiva', nombre: 'Laura', servicio: 'Semis pies',
    });
  });

  it('bloqueo for a service the person no longer offers, and it wins over pendiente', () => {
    const problemas = [problema({ codigo: 'servicio_desvinculado' })];
    const alineacion = { inicios_validos: [], descartados: [] };
    expect(estadoReservaOnline({ ...base, problemas, alineacion })).toEqual({
      tipo: 'bloqueo', motivo: 'desvinculado', nombre: 'Laura', servicio: 'Semis pies',
    });
  });
});
