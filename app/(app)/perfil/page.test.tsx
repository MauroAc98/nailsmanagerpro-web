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
  sena_monto: null,
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

  it('abre Seña y pagos con el monto guardado', () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Seña y pagos' }));
    expect(screen.getByRole('textbox', { name: 'Monto de la seña ($)' })).toHaveValue('5000');
  });

  it('guarda desde Seña y pagos mandando solo sena_monto', async () => {
    mockUseAuth({ user: { ...BASE_USER, sena_monto: 5000 } });
    renderWithProviders(<PerfilPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Seña y pagos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(useAuth().updatePerfil).toHaveBeenCalledWith({ sena_monto: 5000 }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Gastos, ingresos y estadísticas' }));
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
