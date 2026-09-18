import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { Turno } from '@/services/turnoService';
import { SwipeableTurnoCard } from './SwipeableTurnoCard';

function buildTurno(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 1,
    cliente_id: 1,
    cliente: { nombre: 'Ana', apellido: 'Gómez' },
    fecha_hora: '2026-09-17 10:00:00',
    servicios: [{ id: 1, nombre: 'Manicura' }],
    estado: 'confirmado',
    estado_visual: 'confirmado',
    ...overrides,
  } as Turno;
}

describe('SwipeableTurnoCard — swipe-to-cancel resting peek (Change 4)', () => {
  it('rests with the cancel panel peeking (-8px), not fully closed', () => {
    const turno = buildTurno();
    const { container } = renderWithProviders(
      <SwipeableTurnoCard turno={turno} onCancel={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });

  it('compensa el desplazamiento del peek con padding izquierdo, para no recortar el contenido', () => {
    const { container } = renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno()} onCancel={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding.style.paddingLeft).toBe('8px');
  });

  it('does not apply any peek transform when the card has no onCancel', () => {
    const turno = buildTurno();
    const { container } = renderWithProviders(<SwipeableTurnoCard turno={turno} />);
    expect(container.querySelector('[style*="translateX"]')).toBeNull();
  });
});

describe('SwipeableTurnoCard — en_curso layout (Change 5)', () => {
  it('shows the "En curso" indicator in the time column and only the "Finalizar ahora" action', () => {
    const turno = buildTurno({ estado_visual: 'en_curso' });
    renderWithProviders(
      <SwipeableTurnoCard turno={turno} onCancel={vi.fn()} onFinalizar={vi.fn()} />,
    );
    // "EN CURSO" now renders exactly once (moved into the time column) —
    // no more separate badge in the action zone.
    expect(screen.getAllByText('EN CURSO')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Finalizar ahora' })).toBeInTheDocument();
  });

  it('calls onFinalizar when "Finalizar ahora" is pressed', () => {
    const turno = buildTurno({ estado_visual: 'en_curso' });
    const onFinalizar = vi.fn();
    renderWithProviders(
      <SwipeableTurnoCard turno={turno} onCancel={vi.fn()} onFinalizar={onFinalizar} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar ahora' }));
    expect(onFinalizar).toHaveBeenCalledTimes(1);
  });
});
