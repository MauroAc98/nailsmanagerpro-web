import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { es } from '@/messages';
import type { ProError } from '@/lib/pro/errores';
import type { ProListaTurnos, ProTurno } from '@/lib/pro/tipos';
import { ListaTurnosDia } from './ListaTurnosDia';

function turno(id: number, fecha_hora: string, extra: Partial<ProTurno> = {}): ProTurno {
  return {
    id,
    fecha_hora,
    duracion_total_minutos: 60,
    estado_visual: 'confirmado',
    notas: null,
    cliente: { nombre: `Cliente${id}`, apellido: null },
    servicios: [{ id: 1, nombre: 'Esmaltado' }],
    promo: null,
    ...extra,
  };
}

function lista(turnos: ProTurno[], extra: Partial<ProListaTurnos> = {}): ProListaTurnos {
  return { turnos, truncated: false, descartados: 0, ...extra };
}

const base = { data: null, cargando: false, error: null, onReintentar: () => {}, onAbrir: () => {} };

describe('ListaTurnosDia', () => {
  it('ordena los turnos de menor a mayor hora y respeta el orden de los empates', () => {
    const data = lista([
      turno(3, '2026-10-17T15:00:00'),
      turno(1, '2026-10-17T09:30:00'),
      turno(2, '2026-10-17T09:30:00'),
      turno(4, '2026-10-17T08:00:00'),
    ]);
    renderWithProviders(<ListaTurnosDia {...base} data={data} />);

    const nombres = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(nombres[0]).toContain('Cliente4');
    expect(nombres[1]).toContain('Cliente1');
    expect(nombres[2]).toContain('Cliente2');
    expect(nombres[3]).toContain('Cliente3');
    // No muta la lista recibida.
    expect(data.turnos.map((t) => t.id)).toEqual([3, 1, 2, 4]);
  });

  it('sin turnos muestra el estado vacío y no el spinner', () => {
    renderWithProviders(<ListaTurnosDia {...base} data={lista([])} />);
    expect(screen.getByText('No hay turnos para este día.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('sin datos y cargando muestra el spinner, sin texto "Cargando"', () => {
    const { container } = renderWithProviders(<ListaTurnosDia {...base} cargando />);
    expect(screen.getByRole('status', { name: 'Cargando turnos' })).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/Cargando/i);
    expect(screen.queryByText('No hay turnos para este día.')).toBeNull();
  });

  it('sin datos, sin error y sin pedido en curso tampoco muestra el vacío (todavía no llegó nada)', () => {
    renderWithProviders(<ListaTurnosDia {...base} />);
    expect(screen.queryByText('No hay turnos para este día.')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('con datos cacheados y un pedido en vuelo mantiene la lista visible', () => {
    renderWithProviders(<ListaTurnosDia {...base} cargando data={lista([turno(1, '2026-10-17T09:00:00')])} />);
    expect(screen.getByText('Cliente1')).toBeInTheDocument();
  });

  it('un error sin datos muestra el copy de Errores.<kind> y el botón reintentar', () => {
    const onReintentar = vi.fn();
    const error: ProError = { kind: 'network' };
    renderWithProviders(<ListaTurnosDia {...base} error={error} onReintentar={onReintentar} />);

    expect(screen.getByRole('alert')).toHaveTextContent(es.profesionales.Errores.network);
    const boton = screen.getByRole('button', { name: 'Reintentar' });
    expect(boton).toHaveStyle({ minHeight: '44px' });
    fireEvent.click(boton);
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('un error de límite de pedidos conserva la lista y ofrece reintentar', () => {
    const error: ProError = { kind: 'rateLimited', retryAfterSec: null, lockout: false };
    renderWithProviders(<ListaTurnosDia {...base} error={error} data={lista([turno(1, '2026-10-17T09:00:00')])} />);
    expect(screen.getByText('Cliente1')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('no existe ningún estado ni filtro de turnos cancelados', () => {
    renderWithProviders(<ListaTurnosDia {...base} data={lista([turno(1, '2026-10-17T09:00:00')])} />);
    expect(document.body.textContent ?? '').not.toMatch(/cancelad/i);
  });

  it('expone truncated y descartados sin descartarlos', () => {
    const { container } = renderWithProviders(
      <ListaTurnosDia {...base} data={lista([turno(1, '2026-10-17T09:00:00')], { truncated: true, descartados: 2 })} />,
    );
    const ul = container.querySelector('ul');
    expect(ul).toHaveAttribute('data-truncated', 'true');
    expect(ul).toHaveAttribute('data-descartados', '2');
  });

  it('tocar una tarjeta llama a onAbrir con el id', () => {
    const onAbrir = vi.fn();
    renderWithProviders(<ListaTurnosDia {...base} onAbrir={onAbrir} data={lista([turno(42, '2026-10-17T09:00:00')])} />);
    fireEvent.click(within(screen.getByRole('listitem')).getByRole('button'));
    expect(onAbrir).toHaveBeenCalledWith(42);
  });

  it('la hora no se corre con la zona horaria del dispositivo', () => {
    renderWithProviders(<ListaTurnosDia {...base} data={lista([turno(1, '2026-10-17T23:30:00')])} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('23:30');
  });
});
