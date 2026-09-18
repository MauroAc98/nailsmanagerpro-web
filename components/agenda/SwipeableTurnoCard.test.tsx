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

// Cancelar no puede depender solo de un gesto táctil: en escritorio o con
// teclado no hay swipe. El botón "⋯" abre un menú con las acciones visibles.
describe('SwipeableTurnoCard — menú de acciones "⋯"', () => {
  it('muestra el botón "Más acciones" cuando el turno se puede cancelar', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Más acciones' })).toBeInTheDocument();
  });

  it('sin acciones disponibles no muestra el botón', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} />);
    expect(screen.queryByRole('button', { name: 'Más acciones' })).toBeNull();
  });

  it('abre el menú con Editar y Cancelar turno, y Cancelar dispara onCancel y cierra', () => {
    const onCancel = vi.fn();
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} onCancel={onCancel} onPress={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).toBeNull();
  });

  it('Editar abre el detalle (onPress)', () => {
    const onPress = vi.fn();
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} onCancel={vi.fn()} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ofrece Finalizar en el menú solo cuando hay onFinalizar', () => {
    const onFinalizar = vi.fn();
    renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno({ estado_visual: 'en_curso' })} onCancel={vi.fn()} onFinalizar={onFinalizar} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(onFinalizar).toHaveBeenCalledTimes(1);
  });

  it('abrir el menú no dispara el onPress de la card', () => {
    const onPress = vi.fn();
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} onCancel={vi.fn()} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
