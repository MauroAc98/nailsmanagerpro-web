import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { Notificaciones } from '@/services/turnoService';

const mockStore = vi.hoisted(() => ({
  push: vi.fn(),
  state: {
    data: null as unknown,
    loading: false,
    error: null as string | null,
    fetchNotificaciones: vi.fn(),
    marcarVistas: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockStore.push }) }));
vi.mock('@/store/useNotificacionesStore', () => ({
  useNotificacionesStore: () => mockStore.state,
}));

import { NotificacionesBell } from './NotificacionesBell';

const base: Notificaciones = { turnos_manana: 0, no_vistos: 0, mensajes: [] };

const reserva = {
  id: 7,
  turno_id: 31,
  cliente_nombre: 'Camila',
  cliente_apellido: 'Rodriguez',
  fecha_hora: '2026-10-12 15:30:00',
  pagada_at: '2026-10-11T12:00:00.000000Z',
};

function abrir(data: Notificaciones) {
  mockStore.state.data = data;
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <NotificacionesBell />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
}

beforeEach(() => {
  mockStore.push.mockClear();
  mockStore.state = { ...mockStore.state, data: null, loading: false, error: null };
});

describe('NotificacionesBell — reservas online pagadas', () => {
  it('muestra el nombre, el texto y el día y hora del turno', () => {
    abrir({ ...base, reservas_pagadas: [reserva] });
    expect(screen.getByText('Camila Rodriguez reservó online y pagó la seña')).toBeTruthy();
    expect(screen.getByText(/lunes 12.*15:30/i)).toBeTruthy();
  });

  it('no muestra el estado vacío si solo hay reservas', () => {
    abrir({ ...base, reservas_pagadas: [reserva] });
    expect(screen.queryByText(es.common.NotificacionesBell.empty)).toBeNull();
  });

  it('muestra el estado vacío cuando no hay nada', () => {
    abrir({ ...base, reservas_pagadas: [] });
    expect(screen.getByText(es.common.NotificacionesBell.empty)).toBeTruthy();
  });

  it('funciona con un backend viejo que no manda reservas_pagadas', () => {
    abrir(base);
    expect(screen.getByText(es.common.NotificacionesBell.empty)).toBeTruthy();
  });

  it('al tocarla va a la agenda del día del turno', () => {
    abrir({ ...base, reservas_pagadas: [reserva] });
    fireEvent.click(screen.getByText('Camila Rodriguez reservó online y pagó la seña'));
    expect(mockStore.push).toHaveBeenCalledWith('/agenda?fecha=2026-10-12');
  });

  it('va arriba de los mensajes de WhatsApp', () => {
    abrir({
      ...base,
      mensajes: [{
        id: 1, tipo: 'confirmacion', status: 'delivered', cliente_nombre: 'Ana', cliente_apellido: 'X',
        created_at: new Date().toISOString(), mensaje: 'm', cliente_telefono: null, reenviable: false,
      } as never],
      reservas_pagadas: [reserva],
    });
    const reservaEl = screen.getByText('Camila Rodriguez reservó online y pagó la seña');
    const msgEl = screen.getByText(/Ana X/);
    expect(reservaEl.compareDocumentPosition(msgEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
