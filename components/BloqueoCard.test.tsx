import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import BloqueoCard from './BloqueoCard';

type Props = React.ComponentProps<typeof BloqueoCard>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    fecha: 'Jueves, 25 de diciembre de 2026',
    horario: 'Todo el día',
    esHorarioPuntual: false,
    motivo: null,
    nombreProfesional: 'Todo el negocio',
    profesional: null,
    onDelete: vi.fn(),
    ...overrides,
  };
}

const lucia = { nombre: 'Lucía', apellido: 'Gómez', color: '#D79EA4', avatarUrl: null };

function sliding(container: HTMLElement) {
  return container.querySelector('[style*="translateX"]') as HTMLElement;
}

describe('BloqueoCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px)', () => {
    const { container } = renderWithProviders(<BloqueoCard {...props()} />);
    expect(sliding(container).style.transform).toBe('translateX(-8px)');
  });

  it('compensa el peek con padding izquierdo', () => {
    const { container } = renderWithProviders(<BloqueoCard {...props()} />);
    expect(sliding(container).style.paddingLeft).toBe('24px');
  });
});

describe('BloqueoCard — contenido', () => {
  it('muestra fecha, horario, motivo y nombre', () => {
    renderWithProviders(<BloqueoCard {...props({ motivo: 'Vacaciones', nombreProfesional: 'Lucía Gómez', profesional: lucia })} />);
    expect(screen.getByText(/Jueves, 25 de diciembre de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Todo el día/)).toBeInTheDocument();
    expect(screen.getByText('Vacaciones')).toBeInTheDocument();
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
  });

  it('un horario puntual va en ámbar y negrita; "todo el día" queda en subtext', () => {
    const { rerender } = renderWithProviders(<BloqueoCard {...props({ horario: '14:00 - 18:00', esHorarioPuntual: true })} />);
    const puntual = screen.getByTestId('horario-bloqueo');
    expect(puntual).toHaveTextContent('14:00 - 18:00');
    expect(puntual).toHaveStyle({ color: 'var(--ag-amber-fg)', fontWeight: '600' });
    rerender(<BloqueoCard {...props()} />);
    expect(screen.getByTestId('horario-bloqueo')).not.toHaveStyle({ color: 'var(--ag-amber-fg)' });
  });

  it('sin motivo no renderiza la línea de motivo', () => {
    renderWithProviders(<BloqueoCard {...props({ motivo: null })} />);
    expect(screen.queryByTestId('motivo-bloqueo')).not.toBeInTheDocument();
  });

  it('no tiene chevron (no hay pantalla de edición)', () => {
    const { container } = renderWithProviders(<BloqueoCard {...props()} />);
    expect(container.querySelector('polyline[points="9 18 15 12 9 6"]')).toBeNull();
  });

  it('todo el salón: círculo con ícono de local, sin iniciales', () => {
    renderWithProviders(<BloqueoCard {...props()} />);
    const icono = screen.getByTestId('icono-local');
    expect(icono).toBeInTheDocument();
    expect(icono).toHaveStyle({ width: '36px', height: '36px', borderRadius: '18px' });
    expect(screen.queryByTestId('avatar-profesional')).not.toBeInTheDocument();
  });

  it('profesional: avatar circular de 36px con iniciales', () => {
    renderWithProviders(<BloqueoCard {...props({ nombreProfesional: 'Lucía Gómez', profesional: lucia })} />);
    const avatar = screen.getByTestId('avatar-profesional');
    expect(avatar).toHaveTextContent('LG');
    expect(avatar.firstElementChild).toHaveStyle({ width: '36px', height: '36px', borderRadius: '18px' });
    expect(screen.queryByTestId('icono-local')).not.toBeInTheDocument();
  });
});

describe('BloqueoCard — interacción', () => {
  it('tocar el panel de eliminar llama onDelete', () => {
    const onDelete = vi.fn();
    renderWithProviders(<BloqueoCard {...props({ onDelete })} />);
    fireEvent.click(screen.getByText('ELIMINAR'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('un swipe más allá del umbral revela el panel', () => {
    const { container } = renderWithProviders(<BloqueoCard {...props()} />);
    const el = sliding(container);
    fireEvent.touchStart(el, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(el);
    expect(el.style.transform).toBe('translateX(-80px)');
  });

  it('tocar la card cerrada no hace nada', () => {
    const onDelete = vi.fn();
    const { container } = renderWithProviders(<BloqueoCard {...props({ onDelete })} />);
    const el = sliding(container);
    fireEvent.click(el);
    expect(onDelete).not.toHaveBeenCalled();
    expect(el.style.transform).toBe('translateX(-8px)');
  });
});
