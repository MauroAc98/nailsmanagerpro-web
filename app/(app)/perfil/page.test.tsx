import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuth } from '@/hooks/useAuth';
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
  const [editarPersonal] = screen.getAllByRole('button', { name: 'Editar' });
  fireEvent.click(editarPersonal);
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
