import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuth } from '@/hooks/useAuth';
import { routerMock } from '@/test/mocks/nextNavigation';
import type { User } from '@/services/authService';
import PerfilPage from './page';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/hooks/useAuth');

// Slice A: `updatePerfil` must carry `latitud`/`longitud` on the personal
// sheet's save branch, and a 422 keyed on `latitud` (design: all coordinate
// errors key on `latitud`, see A1 apply-progress) must map next to the
// location field instead of firing a generic alert dialog.

const BASE_USER: User = {
  id: 1,
  name: 'Estudio Ana',
  slug: 'ana',
  email: 'ana@example.com',
  telefono: '+543765000000',
  direccion: 'Av. Siempreviva 742',
  latitud: -27.4692,
  longitud: -58.8306,
  is_exempt: false,
  confirmacion_automatica: true,
  recordatorio_automatico: false,
  hora_recordatorio: '20:00',
  sena_tipo: 'fijo',
  sena_porcentaje: null,
  sena_monto: null,
  retencion_iibb_porcentaje: 0,
  comision_mp_vigente: 7.61,
  whatsapp_pide_sena: false,
  whatsapp_sena_titular: null,
  whatsapp_sena_entidad: null,
  whatsapp_sena_alias: null,
  whatsapp_sena_cbu: null,
  whatsapp_requiere_envio_manual: false,
  locale: 'es',
  logo_url: null,
  categorias_gasto: [],
  categorias_ingreso: [],
};

function mockUseAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: BASE_USER,
    token: 'tok',
    loading: false,
    error: null,
    inicializado: true,
    estaAutenticado: true,
    debeCambiarPassword: false,
    emailPendiente: null,
    subscriptionExpired: false,
    supportInfo: null,
    daysLeft: 30,
    subscriptionEndsAt: null,
    isExempt: false,
    mostrarBienvenida: false,
    esPrimerLogin: false,
    login: vi.fn(),
    cambiarPasswordObligatorio: vi.fn(),
    logout: vi.fn(),
    inicializar: vi.fn(),
    updatePerfil: vi.fn().mockResolvedValue(BASE_USER),
    subirLogo: vi.fn(),
    clearError: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    setSubscriptionExpired: vi.fn(),
    setMostrarBienvenida: vi.fn(),
    checkSubscription: vi.fn(),
    nombreEstudio: BASE_USER.name,
    slugAgenda: BASE_USER.slug,
    recordatorioAutomatico: false,
    horaRecordatorio: '20:00',
    requiereEnvioManualWhatsapp: false,
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function abrirSheetPersonal() {
  fireEvent.click(screen.getByRole('button', { name: 'Nombre, contacto y ubicación' }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('PerfilPage — updatePerfil payload carries coordinates', () => {
  it('includes latitud/longitud on the personal sheet save branch', async () => {
    mockUseAuth();
    renderWithProviders(<PerfilPage />);

    abrirSheetPersonal();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalled());
    expect(useAuth().updatePerfil).toHaveBeenCalledWith(
      expect.objectContaining({ latitud: -27.4692, longitud: -58.8306 }),
    );
  });
});

describe('PerfilPage — 422 latitud mapping', () => {
  it('maps errors.latitud next to the location field instead of a generic dialog', async () => {
    mockUseAuth({
      updatePerfil: vi.fn().mockRejectedValue({
        response: { data: { errors: { latitud: ['Guardá la ubicación completa: faltan coordenadas.'] } } },
      }),
    });
    renderWithProviders(<PerfilPage />);

    abrirSheetPersonal();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Guardá la ubicación completa: faltan coordenadas.')).toBeInTheDocument();
  });
});

// Rediseño de Perfil: el hub "Mi negocio" solo navega — Seña y pagos abre su
// propio sheet, Reservas online/Finanzas/Apariencia/Idioma/Ayuda navegan a
// rutas existentes (ver components/perfil/SheetSenaYPagos.tsx y
// app/(app)/perfil/finanzas/page.tsx). El monto ya no se muestra en esta
// página — se ve dentro de Seña y pagos.
describe('PerfilPage — hub "Mi negocio"', () => {
  afterEach(() => {
    routerMock.push.mockClear();
  });

  const abrirSena = () => fireEvent.click(screen.getByRole('button', { name: 'Seña y pagos' }));
  const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  it('no muestra el aviso de reservas online suelto: vive dentro de Reservas online', () => {
    mockUseAuth({ user: { ...BASE_USER, reserva_online_activa: false } });
    renderWithProviders(<PerfilPage />);
    expect(screen.queryByText('Avisos de reservas online')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Avisos de reservas online' })).toBeNull();
  });

  it('abre Seña y pagos con el monto guardado (modo fijo)', () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    expect(screen.getByRole('button', { name: 'Monto fijo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Monto fijo por turno' })).toHaveValue('5000');
  });

  describe('sugerencia de seña (monto fijo) con la reserva web activa', () => {
    afterEach(() => vi.unstubAllEnvs());
    // El backend manda sena_monto como texto (decimal:2).
    const fijoComoLlegaDeLaApi = { ...BASE_USER, sena_monto: '5000.00' as unknown as number };

    it('muestra el desglose y el botón "Usar" cuando la reserva web está activa', () => {
      vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
      mockUseAuth({ user: { ...fijoComoLlegaDeLaApi, reserva_online_activa: true } });
      renderWithProviders(<PerfilPage />);
      abrirSena();
      expect(screen.getByText('El cliente paga')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Usar $5.500,00' })).toBeInTheDocument();
    });

    it('no muestra nada de la comisión si la reserva web no está activa', () => {
      vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
      mockUseAuth({ user: { ...fijoComoLlegaDeLaApi, reserva_online_activa: false } });
      renderWithProviders(<PerfilPage />);
      abrirSena();
      expect(screen.queryByText('El cliente paga')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
    });
  });

  it('abre Seña y pagos con el porcentaje guardado', () => {
    mockUseAuth({ user: { ...BASE_USER, sena_tipo: 'porcentaje', sena_porcentaje: 30 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    expect(screen.getByRole('button', { name: 'Porcentaje' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30%' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hidrata en "Sin seña" un salón sin seña guardada (fijo sin monto, o porcentaje sin valor)', () => {
    for (const user of [
      { ...BASE_USER },
      { ...BASE_USER, sena_monto: 0 },
      { ...BASE_USER, sena_tipo: 'porcentaje' as const, sena_porcentaje: null },
    ]) {
      mockUseAuth({ user });
      const { unmount } = renderWithProviders(<PerfilPage />);
      abrirSena();
      expect(screen.getByRole('button', { name: 'Sin seña' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('No se cobra seña al reservar.')).toBeInTheDocument();
      unmount();
    }
  });

  it('"Sin seña" guarda sena_tipo fijo y sena_monto null', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'Sin seña' }));
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'fijo', sena_monto: null, retencion_iibb_porcentaje: 0,
    }));
  });

  it('"Sin seña" muestra el 422 de Mercado Pago bajo el selector', async () => {
    mockUseAuth({
      user: { ...BASE_USER, sena_monto: 5000 },
      updatePerfil: vi.fn().mockRejectedValue({
        response: { data: { errors: { sena_monto: ['No podés vaciar la seña: tenés Mercado Pago conectado.'] } } },
      }),
    });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'Sin seña' }));
    guardar();
    expect(await screen.findByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });

  it('guarda modo fijo mandando sena_tipo, sena_monto y la retención en 0', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'fijo', sena_monto: 5000, retencion_iibb_porcentaje: 0,
    }));
  });

  it('guarda modo porcentaje mandando sena_tipo y sena_porcentaje, sin sena_monto', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_tipo: 'porcentaje', sena_porcentaje: 30 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'porcentaje', sena_porcentaje: 50, retencion_iibb_porcentaje: 0,
    }));
  });

  it('cambiar de fijo a porcentaje y elegir un chip guarda el porcentaje', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'Porcentaje' }));
    fireEvent.click(screen.getByRole('button', { name: '20%' }));
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'porcentaje', sena_porcentaje: 20, retencion_iibb_porcentaje: 0,
    }));
  });

  it('modo porcentaje sin elegir ninguno no guarda y avisa', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'Porcentaje' }));
    guardar();
    expect(await screen.findByText('Elegí un porcentaje entre 1 y 100.')).toBeInTheDocument();
    expect(useAuth().updatePerfil).not.toHaveBeenCalled();
  });

  it('modo fijo con monto vacío o 0 no guarda', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.change(screen.getByRole('textbox', { name: 'Monto fijo por turno' }), { target: { value: '0' } });
    guardar();
    expect(await screen.findByText('Ingresá un monto mayor a 0.')).toBeInTheDocument();
    expect(useAuth().updatePerfil).not.toHaveBeenCalled();
  });

  it('hidrata "Sí me descuenta" con la retención guardada y la guarda', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000, retencion_iibb_porcentaje: 4 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    expect(screen.getByRole('button', { name: 'Sí me descuenta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Porcentaje de la retención de impuestos' })).toHaveValue('4');
    fireEvent.change(screen.getByRole('textbox', { name: 'Porcentaje de la retención de impuestos' }), { target: { value: '4,5' } });
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'fijo', sena_monto: 5000, retencion_iibb_porcentaje: 4.5,
    }));
  });

  it('"No me descuenta" guarda 0 aunque hubiera una retención cargada', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000, retencion_iibb_porcentaje: 4 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'No me descuenta' }));
    guardar();
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({
      sena_tipo: 'fijo', sena_monto: 5000, retencion_iibb_porcentaje: 0,
    }));
  });

  it('rechaza una retención fuera de rango sin guardar', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000, retencion_iibb_porcentaje: 4 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.change(screen.getByRole('textbox', { name: 'Porcentaje de la retención de impuestos' }), { target: { value: '51' } });
    guardar();
    expect(await screen.findByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
    expect(useAuth().updatePerfil).not.toHaveBeenCalled();
  });

  it('"Sí me descuenta" sin porcentaje no guarda', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    fireEvent.click(screen.getByRole('button', { name: 'Sí me descuenta' }));
    guardar();
    expect(await screen.findByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
    expect(useAuth().updatePerfil).not.toHaveBeenCalled();
  });

  it('un 422 sobre sena_porcentaje se muestra bajo los chips', async () => {
    mockUseAuth({
      user: { ...BASE_USER, sena_tipo: 'porcentaje', sena_porcentaje: 30 },
      updatePerfil: vi.fn().mockRejectedValue({
        response: { data: { errors: { sena_porcentaje: ['El porcentaje debe estar entre 1 y 100.'] } } },
      }),
    });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    guardar();
    expect(await screen.findByText('El porcentaje debe estar entre 1 y 100.')).toBeInTheDocument();
  });

  it('un 422 sobre sena_monto se muestra bajo el monto', async () => {
    mockUseAuth({
      user: { ...BASE_USER, sena_monto: 5000 },
      updatePerfil: vi.fn().mockRejectedValue({
        response: { data: { errors: { sena_monto: ['El monto es obligatorio.'] } } },
      }),
    });
    renderWithProviders(<PerfilPage />);
    abrirSena();
    guardar();
    expect(await screen.findByText('El monto es obligatorio.')).toBeInTheDocument();
  });

  it('guarda desde Mensajes automáticos sin mandar sena_monto', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmación, recordatorio y seña por WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalled());
    const payload = vi.mocked(useAuth().updatePerfil).mock.calls[0][0];
    expect(payload).not.toHaveProperty('sena_monto');
  });

  it('navega a Reservas online, Finanzas, Apariencia, Idioma y Ayuda', () => {
    mockUseAuth();
    renderWithProviders(<PerfilPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Reservas online' }));
    expect(routerMock.push).toHaveBeenLastCalledWith('/configuracion/reservas-online');

    fireEvent.click(screen.getByRole('button', { name: 'Gastos, otros ingresos y estadísticas' }));
    expect(routerMock.push).toHaveBeenLastCalledWith('/perfil/finanzas');

    fireEvent.click(screen.getByRole('button', { name: 'Apariencia' }));
    expect(routerMock.push).toHaveBeenLastCalledWith('/configuracion/apariencia');

    fireEvent.click(screen.getByRole('button', { name: 'Idioma' }));
    expect(routerMock.push).toHaveBeenLastCalledWith('/configuracion/idioma');

    fireEvent.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(routerMock.push).toHaveBeenLastCalledWith('/configuracion/ayuda');
  });

  it('muestra la suscripción como fila informativa, sin botón', () => {
    mockUseAuth({ subscriptionExpired: false, subscriptionEndsAt: null, isExempt: false });
    renderWithProviders(<PerfilPage />);
    expect(screen.getByText('Suscripción')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suscripción' })).toBeNull();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });
});
