import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SlotCard } from './SlotCard';
import type { Slot } from '@/services/slotService';

function buildSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 1,
    user_id: 1,
    hora: '09:00',
    activo: true,
    ...overrides,
  };
}

// Mismo affordance que SwipeableTurnoCard (Change 4, agenda) — pedido
// explícito del usuario de replicar la tira visible del panel de eliminar
// en todas las cards con swipe-to-delete, no solo en Agenda.
describe('SlotCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px), not fully closed', () => {
    const { container } = renderWithProviders(
      <SlotCard slot={buildSlot()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });
  // El peek desplaza la capa 8px a la izquierda y el borde de la card recorta
  // esos 8px: sin compensar, el contenido perdía margen izquierdo.
  it('compensa el desplazamiento del peek con padding izquierdo, para no recortar el contenido', () => {
    const { container } = renderWithProviders(
      <SlotCard slot={buildSlot()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding.style.paddingLeft).toBe('8px');
  });
});
