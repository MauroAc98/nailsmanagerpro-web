import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { HorarioScreen } from './HorarioScreen';
import { AHORA, flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

const reloj = () => AHORA;

describe('HorarioScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
    flujoHasta('horario');
    useReservaOnlineStore.getState().setProfesional('any');
  });
  afterEach(() => setServiceParaTests(null));

  it('si faltan servicios redirige al paso de servicios (guard)', async () => {
    limpiarFlujo();
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios'));
  });

  it('muestra chips de profesional (Cualquiera + del salon) y la tira de dias desde hoy', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByRole('button', { name: 'Lucía' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cualquiera' })).toHaveAttribute('aria-pressed', 'true');
    // 2026-09-19 es sabado
    expect(screen.getByRole('button', { name: /Sáb 19/ })).toBeInTheDocument();
    expect(screen.getByText('Septiembre 2026')).toBeInTheDocument();
  });

  it('hoy respeta la anticipacion: el primer horario del dia elegido es 14:00', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByRole('button', { name: '14:00' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10:00' })).toBeNull();
  });

  it('elegir un dia distinto recarga los horarios', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    expect(await screen.findByRole('button', { name: '10:00' })).toBeInTheDocument();
  });

  it('elegir un horario lo guarda en el store y habilita Continuar', async () => {
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await userEvent.click(await screen.findByRole('button', { name: '10:30' }));
    expect(useReservaOnlineStore.getState().fecha).toBe('2026-09-21');
    expect(useReservaOnlineStore.getState().hora).toBe('10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/datos');
  });

  it('cambiar de profesional invalida el horario elegido', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    await userEvent.click(await screen.findByRole('button', { name: '10:30' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lucía' }));
    expect(useReservaOnlineStore.getState().profesionalId).toBe(2);
    expect(useReservaOnlineStore.getState().hora).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('muestra la duracion total del turno', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByText('Tu turno dura 75 min')).toBeInTheDocument();
  });

  it('dia sin horarios libres muestra el estado vacio', async () => {
    prepararServicio(() => Date.UTC(2026, 8, 20, 0, 0)); // 21:00 del 19: hoy ya no hay turnos
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={() => Date.UTC(2026, 8, 20, 0, 0)} />);
    expect(await screen.findByText('No hay horarios libres este día. Probá con otro.')).toBeInTheDocument();
  });

  it('"Ver más días" extiende la tira', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Sáb 19/ });
    const antes = screen.getAllByRole('button', { name: /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d+/ }).length;
    await userEvent.click(screen.getByRole('button', { name: 'Ver más días' }));
    const despues = screen.getAllByRole('button', { name: /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d+/ }).length;
    expect(despues).toBeGreaterThan(antes);
  });
});
