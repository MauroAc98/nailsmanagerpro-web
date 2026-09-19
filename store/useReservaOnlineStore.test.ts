import { beforeEach, describe, expect, it } from 'vitest';
import { useReservaOnlineStore, claveFlujo } from './useReservaOnlineStore';

const store = () => useReservaOnlineStore.getState();

beforeEach(() => {
  sessionStorage.clear();
  useReservaOnlineStore.getState().reiniciar();
});

describe('useReservaOnlineStore', () => {
  it('activarSlug sin datos guardados arranca vacio', () => {
    store().activarSlug('ana');
    expect(store()).toMatchObject({ slug: 'ana', servicioIds: [], profesionalId: 'any', fecha: null, hora: null });
  });

  it('persiste cada cambio en sessionStorage bajo ro_flow_<slug>', () => {
    store().activarSlug('ana');
    store().setServicios([1, 2]);
    const guardado = JSON.parse(sessionStorage.getItem(claveFlujo('ana')) as string);
    expect(guardado.servicioIds).toEqual([1, 2]);
  });

  it('restaura el estado guardado al reactivar el slug (refresh)', () => {
    store().activarSlug('ana');
    store().setServicios([1]);
    store().setHorario('2026-09-25', '10:00');
    useReservaOnlineStore.setState({ slug: null, servicioIds: [], fecha: null, hora: null });
    store().activarSlug('ana');
    expect(store()).toMatchObject({ servicioIds: [1], fecha: '2026-09-25', hora: '10:00' });
  });

  it('cada slug tiene su propio estado', () => {
    store().activarSlug('ana');
    store().setServicios([1]);
    store().activarSlug('lu');
    expect(store().servicioIds).toEqual([]);
    store().setServicios([5]);
    store().activarSlug('ana');
    expect(store().servicioIds).toEqual([1]);
  });

  it('cambiar servicios o profesional descarta el horario elegido (ya no es valido)', () => {
    store().activarSlug('ana');
    store().setServicios([1]);
    store().setHorario('2026-09-25', '10:00');
    store().setServicios([1, 2]);
    expect(store()).toMatchObject({ fecha: null, hora: null });
    store().setHorario('2026-09-25', '10:00');
    store().setProfesional(2);
    expect(store()).toMatchObject({ profesionalId: 2, fecha: null, hora: null });
  });

  it('setCliente mezcla parcialmente y persiste', () => {
    store().activarSlug('ana');
    store().setCliente({ nombre: 'Sofi' });
    store().setCliente({ whatsapp: '+5491155551234' });
    expect(store().cliente).toEqual({ nombre: 'Sofi', apellido: '', whatsapp: '+5491155551234' });
  });

  it('confirmar limpia lo guardado y el estado, conservando el slug', () => {
    store().activarSlug('ana');
    store().setServicios([1]);
    store().setReservaId('mock-1');
    store().confirmar();
    expect(sessionStorage.getItem(claveFlujo('ana'))).toBeNull();
    expect(store()).toMatchObject({ slug: 'ana', servicioIds: [], reservaId: null });
  });

  it('un JSON corrupto en sessionStorage se ignora', () => {
    sessionStorage.setItem(claveFlujo('ana'), '{no-json');
    store().activarSlug('ana');
    expect(store().servicioIds).toEqual([]);
  });

  it('los tests pueden fijar el estado con setState (sin mocks)', () => {
    useReservaOnlineStore.setState({ slug: 'ana', servicioIds: [3] });
    expect(store().servicioIds).toEqual([3]);
  });
});
