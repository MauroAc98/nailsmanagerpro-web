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

describe('SwipeableTurnoCard — duración del turno', () => {
  it('muestra cuánto dura el turno, junto a la hora', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: 90 })} />);

    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
  });

  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [120, '2 h'],
  ])('%i minutos se lee como "%s"', (minutos, texto) => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: minutos })} />);

    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it('lleva un reloj, escondido para lectores de pantalla', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: 90 })} />);
    const icono = screen.getByText('1 h 30 min').querySelector('svg.lucide-clock');

    expect(icono).not.toBeNull();
    expect(icono).toHaveAttribute('aria-hidden', 'true');
  });

  it('va debajo de la fecha, al final de la columna de la hora (hora, fecha, duración)', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: 90 })} />);
    const duracion = screen.getByText('1 h 30 min');
    const columna = duracion.parentElement as HTMLElement;
    const hijos = Array.from(columna.children);

    expect(hijos[0].textContent).toBe('10:00');
    expect(hijos[1].textContent).toMatch(/\d/); // la fecha
    expect(hijos[2]).toBe(duracion);
  });

  it('ya no usa el reloj de arena', () => {
    const { container } = renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: 90 })} />);

    expect(container.querySelector('svg.lucide-hourglass')).toBeNull();
  });

  it('también en un turno en curso', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ estado_visual: 'en_curso', duracion_total_minutos: 75 })} />);

    expect(screen.getByText('1 h 15 min')).toBeInTheDocument();
  });

  it('una duración que no se conoce no deja "0 min" ni "NaN" en el card', () => {
    const { container } = renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ duracion_total_minutos: undefined as never })} />);

    expect(container.textContent).not.toMatch(/NaN|0 min|undefined/);
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

  it('un turno sin grupo se ve como siempre: sin icono ni "con" (Rule L)', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ grupo_id: null })} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Parte de un turno que atienden varias personas')).toBeNull();
    expect(screen.getByText('Manicura').textContent).toBe('Manicura');
  });

  it('un turno de un grupo que llega suelto (los demás pasos se cancelaron) se ve como un turno normal', () => {
    renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno({ grupo_id: 7, profesional_id: 10, grupo })} onCancel={vi.fn()} />,
    );
    // Sin icono de enlace: las promos con varios pasos se dibujan en VisitaCard.
    expect(screen.queryByLabelText('Parte de un turno que atienden varias personas')).toBeNull();
    // La línea del servicio es solo el servicio: "· con Laura" se leía como si Laura hiciera ese servicio.
    expect(screen.getByText('Manicura').textContent).toBe('Manicura');
    expect(document.body.textContent).not.toMatch(/con Laura|tramo|paralelo|secuencia/i);
  });
});

describe('SwipeableTurnoCard — idea del cliente (notas)', () => {
  it('muestra el ícono cuando el turno trae una nota', () => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ notas: 'Algo minimalista' })} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Tiene una idea del cliente')).toBeInTheDocument();
  });

  it.each([[null], [undefined], [''], ['   ']])('no lo muestra con la nota %j', (notas) => {
    renderWithProviders(<SwipeableTurnoCard turno={buildTurno({ notas })} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Tiene una idea del cliente')).toBeNull();
  });

  it('también en turnos en curso', () => {
    renderWithProviders(
      <SwipeableTurnoCard turno={buildTurno({ estado_visual: 'en_curso', notas: 'Algo' })} onCancel={vi.fn()} onFinalizar={vi.fn()} />,
    );
    expect(screen.getByLabelText('Tiene una idea del cliente')).toBeInTheDocument();
  });
});
