import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/render';
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

  it('muestra avatares de profesional (Cualquiera primero + del salon) y la tira de dias desde hoy', async () => {
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

  it('el subtitulo muestra la duracion total del turno', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByRole('heading', { name: '¿Cuándo venís?' })).toBeInTheDocument();
    expect(await screen.findByText('Tu turno dura 1 h 15 min.')).toBeInTheDocument();
  });

  it('la profesional se elige con avatares de iniciales; "Cualquiera" va primero con estrella', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    const cualquiera = await screen.findByRole('button', { name: 'Cualquiera' });
    expect(within(cualquiera).getByText('★')).toBeInTheDocument();
    const nombres = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-profesional'));
    expect(nombres.map((b) => b.getAttribute('aria-label'))).toEqual(['Cualquiera', 'Ana', 'Lucía']);
    expect(within(screen.getByRole('button', { name: 'Lucía' })).getByText('L')).toBeInTheDocument();
  });

  it('los horarios se agrupan en Mañana (antes de las 13:00) y Tarde en grilla de 4 columnas', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    const manana = (await screen.findByText('Mañana')).parentElement as HTMLElement;
    const tarde = screen.getByText('Tarde').parentElement as HTMLElement;
    expect(within(manana).getByRole('button', { name: '12:30' })).toBeInTheDocument();
    expect(within(manana).queryByRole('button', { name: '13:00' })).toBeNull();
    expect(within(tarde).getByRole('button', { name: '13:00' })).toBeInTheDocument();
    expect(within(tarde).getByRole('button', { name: '18:00' })).toBeInTheDocument();
    expect(within(tarde).getByRole('button', { name: '13:00' }).parentElement).toHaveStyle({
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    });
  });

  it('hoy (desde las 14:00) no hay grupo Mañana', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: '14:00' });
    expect(screen.queryByText('Mañana')).toBeNull();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
  });

  it('el horario elegido queda oscuro (pressed) y la barra inferior muestra dia y hora', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    await userEvent.click(await screen.findByRole('button', { name: '10:30' }));
    expect(screen.getByRole('button', { name: '10:30' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Lunes 21/).closest('div')).toHaveTextContent('Lunes 21 · 10:30 con cualquier profesional');
  });

  it('con una profesional elegida la barra dice con quien', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Lucía' }));
    await userEvent.click(await screen.findByRole('button', { name: /Lun 21/ }));
    await userEvent.click(await screen.findByRole('button', { name: '10:30' }));
    expect(screen.getByText(/Lunes 21/).closest('div')).toHaveTextContent('Lunes 21 · 10:30 con Lucía');
  });

  it('sin horario elegido no hay barra de seleccion', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: '14:00' });
    expect(screen.queryByText(/con cualquier profesional/)).toBeNull();
  });

  it('cuando el servicio sabe la disponibilidad (mock) los dias con horarios llevan punto', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: '14:00' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Lun 21/ }).querySelector('[data-disponible]')).not.toBeNull(),
    );
  });

  it('cuando NO lo sabe (adapter real: null) no se dibuja ningun punto', async () => {
    const svc = prepararServicio();
    setServiceParaTests({ ...svc, getDiasConDisponibilidad: async () => null });
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: '14:00' });
    expect(document.querySelector('[data-disponible]')).toBeNull();
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
