import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('shows the "En curso" indicator (now in the action column, above "Finalizar ahora") and only that one action', () => {
    const turno = buildTurno({ estado_visual: 'en_curso' });
    renderWithProviders(
      <SwipeableTurnoCard turno={turno} onCancel={vi.fn()} onFinalizar={vi.fn()} />,
    );
    // "EN CURSO" renders exactly once — Change 6 (2026-09-30) moved it from
    // the time column to the action column, next to "Finalizar ahora" (same
    // place the "Finalizado" badge already lives), but it's still a single
    // indicator either way.
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

describe('SwipeableTurnoCard — profesional como texto "con {nombre}" (Change 6, 2026-09-30)', () => {
  // Reemplaza el punto de color + nombre en la columna de hora (ambiguo:
  // no se distinguía de un dato de la clienta) — ver canvas aprobado.
  // "con Natalia" va en su propia línea, después del servicio, para no
  // competir por el mismo renglón truncado.
  it('con profesionalLabel, muestra "con {nombre}" debajo del servicio', () => {
    renderWithProviders(
      <SwipeableTurnoCard
        turno={buildTurno()}
        onCancel={vi.fn()}
        profesionalLabel={{ nombre: 'Natalia', color: '#8a7dc9' }}
      />,
    );
    expect(screen.getByText('con Natalia')).toBeInTheDocument();
  });

  it('sin avatarUrl, el mini-avatar cae a iniciales (mismo criterio que SelectorProfesional)', () => {
    renderWithProviders(
      <SwipeableTurnoCard
        turno={buildTurno()}
        onCancel={vi.fn()}
        profesionalLabel={{ nombre: 'Natalia', apellido: 'Diaz', color: '#8a7dc9' }}
      />,
    );
    expect(screen.getByText('ND')).toBeInTheDocument();
  });

  it('con avatarUrl, muestra la foto real en vez de las iniciales', () => {
    renderWithProviders(
      <SwipeableTurnoCard
        turno={buildTurno()}
        onCancel={vi.fn()}
        profesionalLabel={{ nombre: 'Natalia', color: '#8a7dc9', avatarUrl: 'https://cdn.turnetto.com/natalia.jpg' }}
      />,
    );
    const foto = screen.getAllByAltText('').find(img => (img as HTMLImageElement).src.includes('natalia.jpg'));
    expect(foto).toBeDefined();
    expect(screen.queryByText('N')).not.toBeInTheDocument();
  });

  it('sin profesionalLabel (cuenta con una sola profesional), no muestra ningún "con"', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });
});

describe('SwipeableTurnoCard — tooltip del servicio (Change 6, 2026-09-30)', () => {
  // El servicio vuelve a truncarse en una sola línea (cards de altura
  // pareja); el texto completo queda disponible en un tooltip en vez de
  // perderse — ver canvas aprobado. Alcanza con confirmar que el trigger
  // expone el texto completo (vía Tooltip.Trigger render=), no hace falta
  // simular el hover para probar el comportamiento de Base UI en sí.
  it('el texto completo de los servicios sigue en el DOM, aunque se trunque visualmente', () => {
    const turno = buildTurno({
      servicios: [{ id: 1, nombre: 'Capping' }, { id: 2, nombre: 'Semis manos' }],
    });
    renderWithProviders(<SwipeableTurnoCard turno={turno} onCancel={vi.fn()} />);
    expect(screen.getByText('Capping + Semis manos')).toBeInTheDocument();
  });
});

describe('SwipeableTurnoCard — badge "Reserva online"', () => {
  afterEach(() => vi.unstubAllEnvs());

  // Compacto (solo icono, sin texto) desde el fix del nombre cortado — se
  // detecta por aria-label/title, no por texto visible (ver BadgeReservaOnline).
  it('lo muestra en turnos de origen web cuando la flag esta prendida', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ origen: 'web' })} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Reserva online')).toBeInTheDocument();
  });

  it('no lo muestra con la flag apagada', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'false');
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ origen: 'web' })} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Reserva online')).toBeNull();
  });

  it('no lo muestra en turnos cargados desde la app', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ origen: 'app' })} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Reserva online')).toBeNull();
  });
});

describe('SwipeableTurnoCard — turno de un grupo', () => {
  const grupo = {
    id: 7, modo: 'secuencia' as const,
    tramos: [
      { turno_id: 1, profesional_id: 10, profesional_nombre: 'Ana', fecha_hora: '2026-09-17T10:00:00', duracion_total_minutos: 60, estado: 'confirmado' as const },
      { turno_id: 2, profesional_id: 20, profesional_nombre: 'Laura', fecha_hora: '2026-09-17T11:00:00', duracion_total_minutos: 45, estado: 'confirmado' as const },
    ],
  };

  it('un turno sin grupo se ve como siempre: sin icono, sin "con" y sin barra (Rule L)', () => {
    const { container } = renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ grupo_id: null })} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Parte de un turno con varias profesionales')).toBeNull();
    expect(screen.getByText('Manicura').textContent).toBe('Manicura');
    expect(container.querySelector('[data-grupo-barra]')).toBeNull();
  });

  it('muestra el icono de enlace y "con" la otra profesional', () => {
    renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno({ grupo_id: 7, profesional_id: 10, grupo })} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText('Parte de un turno con varias profesionales')).toBeInTheDocument();
    expect(screen.getByText('con Laura')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia/i);
  });

  it('dibuja la barra de union cuando se lo piden', () => {
    const { container } = renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno({ grupo_id: 7, profesional_id: 10, grupo })} onCancel={vi.fn()} barra={{ arriba: false, abajo: true }} />,
    );
    expect(container.querySelector('[data-grupo-barra]')).not.toBeNull();
  });
});
