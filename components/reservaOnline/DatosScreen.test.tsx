import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { DatosScreen } from './DatosScreen';
import { AHORA, flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

const MIN = 60_000;

describe('DatosScreen', () => {
  let reloj = AHORA;
  let svc: MockReservaOnlineService;
  beforeEach(async () => {
    reloj = AHORA;
    svc = prepararServicio(() => reloj);
    limpiarFlujo();
    await flujoHasta('datos', svc);
  });
  afterEach(() => setServiceParaTests(null));

  it('sin horario elegido redirige a horario (guard)', async () => {
    limpiarFlujo();
    await flujoHasta('horario');
    const ir = vi.fn();
    renderWithProviders(<DatosScreen slug="demo" ir={ir} ahora={() => AHORA} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/horario'));
  });

  it('Continuar esta deshabilitado con los datos vacios', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('un WhatsApp sin codigo de pais bloquea Continuar y muestra el error', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '1155');
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá tu número con código de área');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('con datos validos guarda en el store (E.164 normalizado) y avanza al resumen', async () => {
    const ir = vi.fn();
    renderWithProviders(<DatosScreen slug="demo" ir={ir} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '376 512 3456');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useReservaOnlineStore.getState().cliente).toEqual({
      nombre: 'Marta',
      apellido: 'Ríos',
      whatsapp: '+5493765123456',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/resumen'));
  });

  it('Continuar guarda los datos y la idea sobre el hold del servicio', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '376 512 3456');
    await userEvent.type(screen.getByLabelText(/Contanos tu idea/), 'flores');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const { hold } = useReservaOnlineStore.getState();
    await waitFor(async () => {
      await svc.iniciarPago('demo', hold!.reservaId);
      await svc.simulatePayment(hold!.reservaId);
      expect((await svc.listOnlineBookings())[0]).toMatchObject({ clienteNombre: 'Marta Ríos', nota: 'flores' });
    });
  });

  it('sin hold retenido (elegio hora pero nunca lo retuvo) vuelve a horario', async () => {
    limpiarFlujo();
    await flujoHasta('horario');
    useReservaOnlineStore.getState().setHorario('2026-09-25', '13:00');
    const ir = vi.fn();
    renderWithProviders(<DatosScreen slug="demo" ir={ir} ahora={() => AHORA} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/horario'));
  });

  describe('retencion del horario', () => {
    it('muestra en la barra la cuenta regresiva "Tu horario está reservado"', async () => {
      renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA + 30_000} cadaMs={20} />);
      expect(await screen.findByText('Tu horario está reservado · 09:30')).toBeInTheDocument();
    });

    it('si el hold vence mientras completa: "Se liberó tu horario" a ancho completo y "Elegir otro horario" vuelve a horario', async () => {
      const ir = vi.fn();
      renderWithProviders(<DatosScreen slug="demo" ir={ir} ahora={() => AHORA + 10 * MIN} cadaMs={20} />);
      expect(await screen.findByRole('heading', { name: 'Se liberó tu horario' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Nombre')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Elegir otro horario' }));
      expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
      expect(useReservaOnlineStore.getState().hora).toBeNull();
      expect(useReservaOnlineStore.getState().hold).toBeNull();
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
    });

    it('si el servidor dice que el hold vencio al continuar, tambien muestra el aviso y no avanza', async () => {
      const ir = vi.fn();
      useReservaOnlineStore.getState().setCliente({ nombre: 'Lu', apellido: 'Paz', whatsapp: '+5491155551234' });
      renderWithProviders(<DatosScreen slug="demo" ir={ir} ahora={() => AHORA} cadaMs={20} />);
      reloj = AHORA + 11 * MIN; // el reloj del servidor avanzo, el de la pantalla no
      await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
      expect(await screen.findByRole('heading', { name: 'Se liberó tu horario' })).toBeInTheDocument();
      expect(ir).not.toHaveBeenCalledWith('/reservar/demo/resumen');
    });
  });

  it('si el telefono esta en enfriamiento (phone_cooldown) muestra cuanto falta en minutos', async () => {
    setServiceParaTests({
      ...svc,
      actualizarDatosReserva: async () => {
        throw new ReservaOnlineError('phone_cooldown', 'en enfriamiento', 1800);
      },
    });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '376 512 3456');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese número tiene una reserva reciente sin pagar. Probá de nuevo en 30 min.',
    );
  });

  it('si se necesita verificar el WhatsApp (verification_required) muestra un aviso especifico', async () => {
    setServiceParaTests({
      ...svc,
      actualizarDatosReserva: async () => {
        throw new ReservaOnlineError('verification_required');
      },
    });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '376 512 3456');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitamos verificar tu WhatsApp para continuar. Escribinos y te ayudamos.',
    );
  });

  it('si el kill switch del backend esta apagado (creation_disabled) muestra la pantalla completa de "no disponible"', async () => {
    setServiceParaTests({
      ...svc,
      actualizarDatosReserva: async () => {
        throw new ReservaOnlineError('creation_disabled');
      },
    });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '376 512 3456');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Todavía no está disponible' })).toBeInTheDocument();
  });

  it('el prefijo +54 9 es fijo (no editable) y el numero se tipea local', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByText('+54 9')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('');
  });

  it('si pega el numero completo con +54 9 no se duplica el prefijo', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    await userEvent.type(await screen.findByLabelText('WhatsApp'), '+54 9 376 512 3456');
    expect(useReservaOnlineStore.getState().cliente.whatsapp).toBe('+5493765123456');
  });

  it('titulo con subtitulo, ayuda del WhatsApp y linea de privacidad', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByRole('heading', { name: 'Tus datos' })).toBeInTheDocument();
    expect(screen.getByText('Los usamos solo para gestionar tu turno.')).toBeInTheDocument();
    expect(screen.getByText('Te mandamos la confirmación y el recordatorio por acá.')).toBeInTheDocument();
    expect(screen.getByText('Usamos tu número solo para gestionar tu turno.')).toBeInTheDocument();
  });

  it('"Contanos tu idea" es opcional: no bloquea Continuar y se guarda en el store', async () => {
    useReservaOnlineStore.getState().setCliente({ nombre: 'Lu', apellido: 'Paz', whatsapp: '+5491155551234' });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    const nota = await screen.findByLabelText(/Contanos tu idea/);
    expect(screen.getByText('Opcional')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await userEvent.type(nota, 'flores y dorado');
    expect(useReservaOnlineStore.getState().nota).toBe('flores y dorado');
    expect(screen.getByText('Sirve para que el negocio te confirme el valor final.')).toBeInTheDocument();
  });

  it('la idea tiene un maximo de 300 caracteres', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByLabelText(/Contanos tu idea/)).toHaveAttribute('maxlength', '300');
  });

  it('restaura la idea guardada al volver desde el resumen', async () => {
    useReservaOnlineStore.getState().setNota('mi idea');
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByLabelText(/Contanos tu idea/)).toHaveValue('mi idea');
  });

  it('restaura lo guardado al volver desde el resumen', async () => {
    useReservaOnlineStore.getState().setCliente({ nombre: 'Lu', apellido: 'Paz', whatsapp: '+5491155551234' });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} ahora={() => AHORA} />);
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Lu');
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('1155551234');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });
});
