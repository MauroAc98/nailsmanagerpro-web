import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor, within } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { HorarioScreen } from './HorarioScreen';
import { AHORA, flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

const reloj = () => AHORA;

// La rueda de horarios es UNA sola columna cuyos items son los inicios libres.
const rueda = (): HTMLElement => document.querySelector('[data-drum]') as HTMLElement;
const horasDeLaRueda = (): string[] => Array.from(rueda().children).map((c) => c.textContent ?? '');
// Pill del selector compartido: su nombre accesible es "<inicial><nombre>".
const pill = (nombre: string) => screen.getByRole('button', { name: new RegExp(`${nombre}$`) });
const hayRueda = () => document.querySelector('[data-drum]') !== null;
// Gira la rueda hasta `hora` (el alto de cada item es 44px).
function girarA(hora: string) {
  const el = rueda();
  Object.defineProperty(el, 'scrollTop', { value: horasDeLaRueda().indexOf(hora) * 44, configurable: true, writable: true });
  fireEvent.scroll(el);
}
// Va al dia con las flechas de semana (si no esta en la tira actual) y lo toca.
async function irAlDia(fecha: string) {
  for (let i = 0; i < 6 && !screen.queryByTestId(`week-day-${fecha}`); i++) {
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
  }
  await userEvent.click(screen.getByTestId(`week-day-${fecha}`));
}

describe('HorarioScreen', () => {
  let svc: MockReservaOnlineService;
  beforeEach(async () => {
    svc = prepararServicio();
    limpiarFlujo();
    await flujoHasta('horario');
    useReservaOnlineStore.getState().setProfesional('any');
  });
  afterEach(() => setServiceParaTests(null));

  it('si faltan servicios redirige al paso de servicios (guard)', async () => {
    limpiarFlujo();
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios'));
  });

  it('muestra el selector de profesional y la tira de semana de la agenda con flechas y boton Calendario', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByRole('button', { name: /Lucía$/ })).toBeInTheDocument();
    expect(pill('Cualquiera')).toHaveAttribute('aria-pressed', 'true');
    // 2026-09-19 es sabado: semana lunes 14 a domingo 20
    expect(screen.getByText('14 – 20 de sept')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver calendario completo' })).toBeInTheDocument();
    expect(screen.getByTestId('week-day-2026-09-19')).toBeInTheDocument();
  });

  it('los dias anteriores a hoy estan deshabilitados y la flecha de semana anterior tambien', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    expect(screen.getByTestId('week-day-2026-09-18')).toBeDisabled();
    expect(screen.getByTestId('week-day-2026-09-19')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeEnabled();
  });

  it('hoy respeta la anticipacion: el primer horario de la rueda es 14:00 y no hay 10:00', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() => expect(hayRueda()).toBe(true));
    expect(horasDeLaRueda()[0]).toBe('14:00');
    expect(horasDeLaRueda()).not.toContain('10:00');
  });

  it('la rueda lista SOLO los inicios libres: no aparecen los ocupados del demo (14:30-15:30 con Cualquiera)', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    const horas = horasDeLaRueda();
    // solo los inicios configurados que entran (75 min), sin horarios intermedios
    expect(horas).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30', '13:00', '14:00', '16:00', '16:30', '17:30', '18:00']);
    expect(horas).toContain('14:00');
    for (const ocupada of ['14:30', '15:00', '15:30']) expect(horas).not.toContain(ocupada);
    expect(horas).toContain('16:00');
    // una sola columna: no hay ruedas separadas de hora y minuto
    expect(document.querySelectorAll('[data-drum]')).toHaveLength(1);
  });

  it('cambiar de profesional refetchea (Ana tambien ocupada a las 14:00) e invalida la hora elegida', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()).toContain('14:00'));
    girarA('10:30');
    expect(useReservaOnlineStore.getState().hora).toBe('10:30');
    await userEvent.click(pill('Ana'));
    expect(useReservaOnlineStore.getState().profesionalId).toBe(1);
    expect(useReservaOnlineStore.getState().hora).toBeNull();
    await waitFor(() => expect(horasDeLaRueda()).not.toContain('14:00'));
  });

  it('muestra el resumen de horarios libres (plural) con el rango de la rueda', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    expect(await screen.findByText('11 horarios libres · de 09:00 a 18:00')).toBeInTheDocument();
  });

  it('la nota de duracion muestra el rango que ocupara el turno y cambia al girar la rueda', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    expect(screen.getByText(/Tu turno ocupa de/)).toHaveTextContent('Tu turno ocupa de 09:00 a 10:15.');
    girarA('13:00');
    expect(screen.getByText(/Tu turno ocupa de/)).toHaveTextContent('Tu turno ocupa de 13:00 a 14:15.');
  });

  it('cambiar de semana con las flechas refetchea los horarios y limpia la hora elegida', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('14:00'));
    girarA('16:00');
    expect(useReservaOnlineStore.getState().hora).toBe('16:00');
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    // mismo dia de la semana (sabado 26) y semana 21 - 27
    expect(screen.getByText('21 – 27 de sept')).toBeInTheDocument();
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    expect(useReservaOnlineStore.getState().hora).toBeNull();
    // ahora si se puede volver: la semana anterior ya no esta deshabilitada
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeEnabled();
  });

  it('el boton Calendario abre el calendario mensual: dias pasados deshabilitados, dias reservables no', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    expect(document.querySelector('[data-calendario-abierto="true"]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver calendario completo' }));
    expect(document.querySelector('[data-calendario-abierto="true"]')).not.toBeNull();
    expect(screen.getByTestId('cal-day-2026-09-18')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('cal-day-2026-09-19')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('cal-day-2026-09-29')).not.toHaveAttribute('aria-disabled');
  });

  it('el ultimo dia reservable del calendario es hoy + 30; el siguiente esta deshabilitado', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    await userEvent.click(screen.getByRole('button', { name: 'Ver calendario completo' }));
    // hoy 2026-09-19 + 30 = 2026-10-19: mes siguiente con la flecha de la cabecera (0 = cerrar, 1 = mes anterior)
    const contenedor = document.querySelector('[data-calendario-abierto]') as HTMLElement;
    fireEvent.click(within(contenedor).getAllByRole('button')[2]);
    expect(screen.getByTestId('cal-day-2026-10-19')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('cal-day-2026-10-20')).toHaveAttribute('aria-disabled', 'true');
  });

  it('elegir un dia en el calendario lo selecciona, refetchea y cierra; uno deshabilitado no hace nada', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    await userEvent.click(screen.getByRole('button', { name: 'Ver calendario completo' }));
    fireEvent.click(screen.getByTestId('cal-day-2026-09-18'));
    expect(screen.getByText('14 – 20 de sept')).toBeInTheDocument();
    expect(document.querySelector('[data-calendario-abierto="true"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('cal-day-2026-09-30'));
    expect(screen.getByText('28 de sept – 4 de oct')).toBeInTheDocument();
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    expect(document.querySelector('[data-calendario-abierto="true"]')).toBeNull();
  });

  it('girar la rueda guarda la hora en el store y Continuar queda habilitado', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    expect(useReservaOnlineStore.getState().fecha).toBe('2026-09-21');
    expect(useReservaOnlineStore.getState().hora).toBe('10:30');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('Continuar RETIENE el horario (con "Cualquiera" resuelve la profesional), guarda el hold y avanza a datos', async () => {
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/datos'));
    const { hold } = useReservaOnlineStore.getState();
    expect(hold).toMatchObject({ profesionalId: 1, expiraMs: AHORA + 10 * 60_000 });
    await expect(
      svc.retenerHorario('demo', { servicioIds: [1, 2], profesionalId: 1, fecha: '2026-09-21', hora: '10:30' }),
    ).rejects.toMatchObject({ code: 'slot_taken' });
  });

  it('sin girar la rueda no avanza solo; Continuar retiene la primera hora libre', async () => {
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    expect(ir).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/datos'));
    expect(useReservaOnlineStore.getState().hora).toBe('09:00');
  });

  it('si el horario ya no esta libre: mensaje amable, se queda en horario, limpia la hora y refresca la rueda', async () => {
    const ir = vi.fn();
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    // otra clienta lo toma mientras esta miraba la lista
    await svc.retenerHorario('demo', { servicioIds: [1, 2], fecha: '2026-09-21', hora: '10:30' });
    await svc.retenerHorario('demo', { servicioIds: [1, 2], fecha: '2026-09-21', hora: '10:30' }); // Lucia tambien
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario se acaba de ocupar. Elegí otro.');
    expect(ir).not.toHaveBeenCalled();
    expect(useReservaOnlineStore.getState().hold).toBeNull();
    await waitFor(() => expect(horasDeLaRueda()).not.toContain('10:30'));
  });

  it('si el kill switch del backend esta apagado (creation_disabled) muestra la pantalla completa de "no disponible", nunca el mensaje generico', async () => {
    const ir = vi.fn();
    setServiceParaTests({
      ...svc,
      retenerHorario: async () => {
        throw new ReservaOnlineError('creation_disabled', 'La reserva online todavía no está disponible.');
      },
    });
    renderWithProviders(<HorarioScreen slug="demo" ir={ir} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Todavía no está disponible' })).toBeInTheDocument();
    expect(screen.queryByText('Ese horario se acaba de ocupar. Elegí otro.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    expect(ir).not.toHaveBeenCalled();
  });

  it('si el backend limita los intentos (rate_limited) muestra un aviso especifico, no el generico', async () => {
    setServiceParaTests({
      ...svc,
      retenerHorario: async () => {
        throw new ReservaOnlineError('rate_limited', 'Hiciste muchos intentos.', 60);
      },
    });
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hiciste muchos intentos. Esperá un momento y volvé a intentarlo.');
  });

  it('si el reto anti-bot falla (challenge_failed) muestra un aviso especifico', async () => {
    setServiceParaTests({
      ...svc,
      retenerHorario: async () => {
        throw new ReservaOnlineError('challenge_failed');
      },
    });
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos verificar que sos una persona. Volvé a intentarlo.');
  });

  it('al volver al horario con un hold vigente lo suelta antes de elegir otro (y el horario propio vuelve a estar libre)', async () => {
    await flujoHasta('datos', svc); // hold de 13:00 del 25/09 con Ana
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() => expect(useReservaOnlineStore.getState().hold).toBeNull());
    await waitFor(() => expect(hayRueda()).toBe(true));
    expect(horasDeLaRueda()).toContain('13:00');
    const otra = await svc.retenerHorario('demo', { servicioIds: [1, 2], profesionalId: 1, fecha: '2026-09-25', hora: '13:00' });
    expect(otra.reservaId).toBeDefined(); // estaba liberado
  });

  it('el subtitulo muestra la duracion total del turno', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    expect(await screen.findByRole('heading', { name: '¿Cuándo venís?' })).toBeInTheDocument();
    expect(await screen.findByText('Tu turno dura 1 h 15 min.')).toBeInTheDocument();
  });

  it('usa el selector compartido de la agenda: "Cualquiera" primero y elegida, luego las profesionales', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    const nombres = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(nombres.map((b) => b.textContent)).toEqual(['Cualquiera', 'ANAna', 'LULucía']);
    expect(pill('Cualquiera')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('Ana')).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una profesional la marca y tocarla de nuevo vuelve a "Cualquiera"', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await screen.findByRole('button', { name: /Lucía$/ });
    await userEvent.click(pill('Lucía'));
    expect(useReservaOnlineStore.getState().profesionalId).toBe(2);
    expect(pill('Lucía')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('Cualquiera')).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(pill('Lucía'));
    expect(useReservaOnlineStore.getState().profesionalId).toBe('any');
    expect(pill('Cualquiera')).toHaveAttribute('aria-pressed', 'true');
  });

  it('con una sola profesional no se muestra el selector', async () => {
    setServiceParaTests({
      ...svc,
      getSalon: async (slug: string) => {
        const info = await svc.getSalon(slug);
        return { ...info, profesionales: info.profesionales.slice(0, 1) };
      },
    });
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() => expect(hayRueda()).toBe(true));
    expect(screen.queryByRole('button', { name: 'Cualquiera' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ana$/ })).toBeNull();
  });

  it('la barra inferior muestra dia y hora elegidos, y con quien si hay profesional', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await irAlDia('2026-09-21');
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:00'));
    girarA('10:30');
    expect(screen.getByText(/Lunes 21/).closest('div')).toHaveTextContent('Lunes 21 · 10:30 con cualquier profesional');
    await userEvent.click(pill('Lucía'));
    await waitFor(() => expect(horasDeLaRueda()[0]).toBe('09:30')); // Lucia arranca a las 09:30
    girarA('10:30');
    expect(screen.getByText(/Lunes 21/).closest('div')).toHaveTextContent('Lunes 21 · 10:30 con Lucía');
  });

  it('cuando el servicio sabe la disponibilidad (mock) los dias con horarios de la semana llevan punto', async () => {
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() =>
      expect(screen.getByTestId('week-day-2026-09-20').querySelector('[data-punto]')).not.toBeNull(),
    );
  });

  it('cuando NO lo sabe (adapter real: null) no se dibuja ningun punto', async () => {
    const otro = prepararServicio();
    setServiceParaTests({ ...otro, getDiasConDisponibilidad: async () => null });
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
    await waitFor(() => expect(hayRueda()).toBe(true));
    expect(document.querySelector('[data-punto]')).toBeNull();
  });

  it('si "hoy" ya no tiene lugar por la anticipacion (22:30 + 2 h) arranca en el primer dia reservable', async () => {
    const tarde = () => Date.UTC(2026, 8, 20, 1, 30); // 22:30 del sabado 19 en el salon
    prepararServicio(tarde);
    renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={tarde} />);
    await waitFor(() => expect(hayRueda()).toBe(true));
    expect(screen.getByTestId('week-day-2026-09-19')).toBeDisabled();
    expect(horasDeLaRueda()[0]).toBe('09:00');
    expect(screen.getByText(/Domingo 20/)).toBeInTheDocument();
  });

  describe('dia sin horarios libres', () => {
    // Servicio mock sin horarios antes de `desde`; desde esa fecha usa el mock real.
    const sinLugarHasta = (desde: string) => {
      const base = prepararServicio();
      const consultadas: string[] = [];
      setServiceParaTests({
        ...base,
        getDiasConDisponibilidad: async () => null,
        getAvailability: async (slug, q) => {
          consultadas.push(q.fecha);
          if (q.fecha < desde) return { fecha: q.fecha, duracionTotalMinutos: 75, slots: [] };
          return base.getAvailability(slug, q);
        },
      });
      return consultadas;
    };

    it('no dibuja la rueda: muestra el estado vacio con "Ir al próximo día con lugar" y "Elegir otro día"', async () => {
      sinLugarHasta('2026-09-30');
      renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
      expect(await screen.findByText('No hay horarios libres este día. Probá con otro.')).toBeInTheDocument();
      expect(hayRueda()).toBe(false);
      expect(screen.getByRole('button', { name: 'Ir al próximo día con lugar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elegir otro día' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    });

    it('"Ir al próximo día con lugar" busca dia por dia y salta al primero con horarios', async () => {
      const consultadas = sinLugarHasta('2026-09-22');
      renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Ir al próximo día con lugar' }));
      await waitFor(() => expect(hayRueda()).toBe(true));
      expect(horasDeLaRueda()[0]).toBe('09:00');
      expect(screen.getByText('21 – 27 de sept')).toBeInTheDocument();
      expect(screen.getByText(/Martes 22/)).toBeInTheDocument();
      expect(consultadas).toEqual(expect.arrayContaining(['2026-09-20', '2026-09-21', '2026-09-22']));
    });

    it('si en toda la ventana no hay lugar lo dice y no salta', async () => {
      sinLugarHasta('2027-01-01');
      renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Ir al próximo día con lugar' }));
      expect(await screen.findByText(/No hay lugar en los próximos 30 días/)).toBeInTheDocument();
      expect(hayRueda()).toBe(false);
    });

    describe('con la lectura de dias con lugar (salon real)', () => {
      // getDiasConDisponibilidad responde `dias`; getAvailability del dia elegido esta
      // vacio hasta `desde`. Se registran los pedidos de ambas lecturas.
      const conDias = (dias: string[] | null, desde = '2026-09-22') => {
        const base = prepararServicio();
        const pedidosDias: { fechas: string[]; profesionalId?: number; servicioIds: number[] }[] = [];
        const consultadas: string[] = [];
        setServiceParaTests({
          ...base,
          getDiasConDisponibilidad: async (_slug, q) => {
            pedidosDias.push(q);
            return dias === null ? null : q.fechas.filter((f) => dias.includes(f));
          },
          getAvailability: async (slug, q) => {
            consultadas.push(q.fecha);
            if (q.fecha < desde) return { fecha: q.fecha, duracionTotalMinutos: 75, slots: [] };
            return base.getAvailability(slug, q);
          },
        });
        return { pedidosDias, consultadas };
      };

      it('la tira dibuja los puntos que devuelve la lectura (y solo esos)', async () => {
        conDias(['2026-09-20']);
        renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
        await waitFor(() =>
          expect(screen.getByTestId('week-day-2026-09-20').querySelector('[data-punto]')).not.toBeNull(),
        );
        expect(screen.getByTestId('week-day-2026-09-19').querySelector('[data-punto]')).toBeNull();
      });

      it('pide toda la ventana en una lectura y la repite al cambiar de profesional', async () => {
        const { pedidosDias } = conDias(['2026-09-22']);
        renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
        await waitFor(() => expect(pedidosDias.length).toBeGreaterThan(0));
        const antes = pedidosDias.length;
        expect(pedidosDias[antes - 1].profesionalId).toBeUndefined();
        await userEvent.click(await screen.findByRole('button', { name: /Lucía$/ }));
        await waitFor(() => expect(pedidosDias.length).toBeGreaterThan(antes));
        expect(pedidosDias[pedidosDias.length - 1].profesionalId).toBeDefined();
      });

      it('"Ir al próximo día con lugar" usa la lista (una lectura) y no recorre dia por dia', async () => {
        const { pedidosDias, consultadas } = conDias(['2026-09-22', '2026-09-25']);
        renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
        await userEvent.click(await screen.findByRole('button', { name: 'Ir al próximo día con lugar' }));
        await waitFor(() => expect(hayRueda()).toBe(true));
        expect(screen.getByText(/Martes 22/)).toBeInTheDocument();
        // solo la del dia elegido (19 y 22); nunca los intermedios
        expect(consultadas).not.toContain('2026-09-20');
        expect(consultadas).not.toContain('2026-09-21');
        expect(pedidosDias[pedidosDias.length - 1].fechas[0]).toBe('2026-09-20');
      });

      it('si la lista viene vacia dice que no hay lugar en 30 dias, con la sugerencia, sin recorrer', async () => {
        const { consultadas } = conDias([]);
        renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
        await userEvent.click(await screen.findByRole('button', { name: 'Ir al próximo día con lugar' }));
        expect(
          await screen.findByText('No hay lugar en los próximos 30 días. Probá con otra profesional o contactá al salón.'),
        ).toBeInTheDocument();
        expect(consultadas).toEqual(['2026-09-19']);
      });

      it('si la lectura devuelve null cae al recorrido dia por dia', async () => {
        const { consultadas } = conDias(null);
        renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
        await userEvent.click(await screen.findByRole('button', { name: 'Ir al próximo día con lugar' }));
        await waitFor(() => expect(hayRueda()).toBe(true));
        expect(consultadas).toEqual(expect.arrayContaining(['2026-09-20', '2026-09-21', '2026-09-22']));
      });
    });

    it('"Elegir otro día" abre el calendario mensual', async () => {
      sinLugarHasta('2026-09-30');
      renderWithProviders(<HorarioScreen slug="demo" ir={() => {}} ahora={reloj} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Elegir otro día' }));
      expect(document.querySelector('[data-calendario-abierto="true"]')).not.toBeNull();
    });
  });
});
