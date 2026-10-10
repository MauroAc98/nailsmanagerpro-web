import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => ({
  ...(await import('@/test/mocks/nextNavigation')).nextNavigationMock,
  useParams: () => ({ id: '7' }),
}));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '@/lib/api';
import DetalleNotificacionPage from './page';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import type { NotificacionMensaje } from '@/services/turnoService';

const mockedPost = vi.mocked(api.post);

function mensaje(overrides: Partial<NotificacionMensaje> = {}): NotificacionMensaje {
  return {
    id: 7, tipo: 'recordatorio', status: 'failed',
    cliente_nombre: 'Martina', cliente_apellido: 'Diaz',
    created_at: new Date().toISOString(),
    mensaje: 'Hola Martina, te recordamos tu turno',
    cliente_telefono: '+543765123456',
    reenviable: true,
    ...overrides,
  };
}

function seed(m: NotificacionMensaje): void {
  useNotificacionesStore.setState({
    data: { turnos_manana: 0, no_vistos: 0, mensajes: [m] },
    loading: false, error: null,
    fetchNotificaciones: async () => {},
  });
}

beforeEach(() => {
  resetNavigationMock();
  mockedPost.mockReset();
  mockedPost.mockResolvedValue({ data: { ok: true } });
});

describe('DetalleNotificacionPage — reenvío manual', () => {
  it('un fallido reenviable ofrece mandarlo desde el WhatsApp propio con el mismo texto', () => {
    seed(mensaje());
    renderWithProviders(<DetalleNotificacionPage />);

    const link = screen.getByRole('link', { name: 'Enviar desde mi WhatsApp' });
    expect(link).toHaveAttribute(
      'href',
      `https://wa.me/5493765123456?text=${encodeURIComponent('Hola Martina, te recordamos tu turno')}`,
    );
  });

  it('el texto reenviado no lleva el aviso de "solo se envían avisos" (sale del WhatsApp propio)', () => {
    seed(mensaje({
      mensaje: 'Hola Martina\n\n⚠️ Desde este número solo se envían avisos. Si respondés a este mensaje, *Ana no lo recibe y no puede contestarte.*\n\nPara consultas, comunicate al 123.',
    }));
    renderWithProviders(<DetalleNotificacionPage />);

    const href = screen.getByRole('link', { name: 'Enviar desde mi WhatsApp' }).getAttribute('href') ?? '';
    expect(decodeURIComponent(href.split('text=')[1])).toBe('Hola Martina\n\nPara consultas, comunicate al 123.');
  });

  it('al tocarlo lo marca como enviado a mano', async () => {
    seed(mensaje());
    renderWithProviders(<DetalleNotificacionPage />);

    fireEvent.click(screen.getByRole('link', { name: 'Enviar desde mi WhatsApp' }));

    expect(mockedPost).toHaveBeenCalledWith('/turnos/notificaciones/7/reenvio-manual');
    expect(await screen.findByText('Enviado a mano')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enviar desde mi WhatsApp' })).not.toBeInTheDocument();
  });

  it('un fallido de nuestro lado no ofrece reenviar y lo explica', () => {
    seed(mensaje({ reenviable: false }));
    renderWithProviders(<DetalleNotificacionPage />);

    expect(screen.queryByRole('link', { name: 'Enviar desde mi WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByText(/problema nuestro/)).toBeInTheDocument();
  });

  it('un mensaje entregado no ofrece reenviar', () => {
    seed(mensaje({ status: 'delivered', reenviable: false }));
    renderWithProviders(<DetalleNotificacionPage />);

    expect(screen.queryByRole('link', { name: 'Enviar desde mi WhatsApp' })).not.toBeInTheDocument();
    expect(screen.queryByText(/problema nuestro/)).not.toBeInTheDocument();
  });
});
