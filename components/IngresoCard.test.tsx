import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import IngresoCard from './IngresoCard';
import type { Ingreso } from '@/services/ingresoService';

function buildIngreso(overrides: Partial<Ingreso> = {}): Ingreso {
  return {
    id: 1,
    user_id: 1,
    monto: '100',
    categoria: 'servicio',
    fecha: '2026-09-18',
    descripcion: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

// Mismo affordance que SwipeableTurnoCard (Change 4, agenda) — pedido
// explícito del usuario de replicar la tira visible del panel de eliminar
// en todas las cards con swipe-to-delete, no solo en Agenda.
describe('IngresoCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px), not fully closed', () => {
    const { container } = renderWithProviders(
      <IngresoCard ingreso={buildIngreso()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });
});
