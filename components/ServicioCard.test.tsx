import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import ServicioCard from './ServicioCard';
import type { Servicio } from '@/services/servicioService';

function buildServicio(overrides: Partial<Servicio> = {}): Servicio {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Manicura',
    duracion_minutos: 30,
    precio: '100',
    activo: true,
    es_promo: false,
    orden: 0,
    categoria_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

// Mismo affordance que SwipeableTurnoCard (Change 4, agenda) — pedido
// explícito del usuario de replicar la tira visible del panel de eliminar
// en todas las cards con swipe-to-delete, no solo en Agenda.
describe('ServicioCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px), not fully closed', () => {
    const { container } = renderWithProviders(
      <ServicioCard servicio={buildServicio()} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });
});
