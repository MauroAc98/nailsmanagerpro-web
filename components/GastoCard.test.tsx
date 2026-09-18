import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import GastoCard from './GastoCard';
import type { Gasto } from '@/services/gastoService';

function buildGasto(overrides: Partial<Gasto> = {}): Gasto {
  return {
    id: 1,
    user_id: 1,
    monto: '100',
    categoria: 'insumos',
    fecha: '2026-09-18',
    descripcion: null,
    profesional_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

// Mismo affordance que SwipeableTurnoCard (Change 4, agenda) — pedido
// explícito del usuario de replicar la tira visible del panel de eliminar
// en todas las cards con swipe-to-delete, no solo en Agenda.
describe('GastoCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px), not fully closed', () => {
    const { container } = renderWithProviders(
      <GastoCard gasto={buildGasto()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });
});
