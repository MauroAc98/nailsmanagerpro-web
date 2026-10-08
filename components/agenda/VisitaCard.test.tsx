import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { Turno } from '@/services/turnoService';
import { agruparVisitas, type VisitaAgenda } from '@/lib/visitasAgenda';
import { VisitaCard } from './VisitaCard';

type Tramo = NonNullable<Turno['grupo']>['tramos'][number];

const tramo = (turno_id: number, profesional_id: number, nombre: string, fecha_hora: string, dur: number, servicio: string, over: Partial<Tramo> = {}): Tramo => ({
  turno_id, profesional_id, profesional_nombre: nombre, fecha_hora, duracion_total_minutos: dur, estado: 'confirmado',
  servicios: [{ id: turno_id, nombre: servicio }], ...over,
});

const turno = (id: number, tramos: Tramo[], promo: { id: number; nombre: string } | null, over: Partial<Turno> = {}): Turno => {
  const propio = tramos.find((t) => t.turno_id === id)!;
  return {
    id, cliente_id: 1, cliente: { nombre: 'Fulano', apellido: 'Detal', telefono: '3764000000' }, servicios: propio.servicios!,
    estado: 'confirmado', estado_visual: 'confirmado', fecha_hora: propio.fecha_hora, duracion_total_minutos: propio.duracion_total_minutos,
    profesional_id: propio.profesional_id, grupo_id: 7, grupo: { id: 7, modo: 'secuencia', promo, tramos }, ...over,
  } as Turno;
};

const TRAMOS = [
  tramo(1, 10, 'Mauro', '2026-10-09T09:00:00', 90, 'Capping'),
  tramo(2, 20, 'Mengano', '2026-10-09T10:30:00', 120, 'Soft gel'),
];
const PROMO = { id: 5, nombre: 'Promo Día de la Madre' };

const armar = (opts: { tramos?: Tramo[]; promo?: typeof PROMO | null; filtro?: number | null; over?: Record<number, Partial<Turno>> } = {}): VisitaAgenda => {
  const tramos = opts.tramos ?? TRAMOS;
  const turnos = tramos
    .filter((t) => t.fecha_hora.startsWith('2026-10-09'))
    .map((t) => turno(t.turno_id, tramos, opts.promo === undefined ? PROMO : opts.promo, opts.over?.[t.turno_id]));
  return agruparVisitas(turnos, opts.filtro ?? null)[0] as VisitaAgenda;
};

const profesionalDe = (id: number) => ({ nombre: id === 10 ? 'Mauro' : 'Mengano', color: '#888888' });

const props = () => ({ onAbrirPaso: vi.fn(), onCancel: vi.fn(), onFinalizarPaso: vi.fn() });

describe('VisitaCard · contenido', () => {
  it('muestra el cliente, la promo con su nombre y un paso por turno con hora, servicio y profesional', () => {
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...props()} />);

    expect(screen.getByText('Fulano Detal')).toBeInTheDocument();
    expect(screen.getByText('Promo')).toBeInTheDocument();
    expect(screen.getByText('Promo Día de la Madre')).toBeInTheDocument();
    const capping = screen.getByRole('button', { name: /Capping/ });
    expect(within(capping).getByText('09:00')).toBeInTheDocument();
    expect(within(capping).getByText('1 h 30 min')).toBeInTheDocument();
    expect(within(capping).getByText('con Mauro')).toBeInTheDocument();
    const softGel = screen.getByRole('button', { name: /Soft gel/ });
    expect(within(softGel).getByText('10:30')).toBeInTheDocument();
    expect(within(softGel).getByText('con Mengano')).toBeInTheDocument();
  });

  it('una seleccion suelta no lleva la pastilla Promo y dice cuantos servicios son', () => {
    renderWithProviders(<VisitaCard visita={armar({ promo: null })} profesionalDe={profesionalDe} {...props()} />);

    expect(screen.queryByText('Promo')).not.toBeInTheDocument();
    expect(screen.getByText('2 servicios agendados juntos')).toBeInTheDocument();
  });

  it('un paso completado se marca como Listo', () => {
    const tramos = [{ ...TRAMOS[0], estado: 'completado' as const }, TRAMOS[1]];
    renderWithProviders(<VisitaCard visita={armar({ tramos, over: { 1: { estado: 'completado', estado_visual: 'completado' } } })} profesionalDe={profesionalDe} {...props()} />);

    expect(within(screen.getByRole('button', { name: /Capping/ })).getByText('Listo')).toBeInTheDocument();
  });

  it('un paso de otro dia se ve con su fecha y no se puede abrir', () => {
    const tramos = [TRAMOS[0], tramo(2, 20, 'Mengano', '2026-10-10T10:30:00', 120, 'Soft gel')];
    renderWithProviders(<VisitaCard visita={armar({ tramos })} profesionalDe={profesionalDe} {...props()} />);

    expect(screen.getByText('Soft gel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Soft gel/ })).not.toBeInTheDocument();
    expect(screen.getByText(/10\/10/)).toBeInTheDocument();
  });

  it('con filtro, apaga los pasos de otras personas y resalta el propio', () => {
    renderWithProviders(<VisitaCard visita={armar({ filtro: 20 })} profesionalDe={profesionalDe} {...props()} />);

    expect(screen.getByRole('button', { name: /Capping/ })).toHaveStyle({ opacity: '0.5' });
    expect(screen.getByRole('button', { name: /Soft gel/ })).toHaveStyle({ opacity: '1' });
  });
});

describe('VisitaCard · toques', () => {
  it('tocar una fila abre ese paso', () => {
    const p = props();
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...p} />);

    fireEvent.click(screen.getByRole('button', { name: /Soft gel/ }));

    expect(p.onAbrirPaso).toHaveBeenCalledWith(2);
  });

  it('el encabezado no abre nada', () => {
    const p = props();
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...p} />);

    fireEvent.click(screen.getByText('Fulano Detal'));
    fireEvent.click(screen.getByText('Promo Día de la Madre'));

    expect(p.onAbrirPaso).not.toHaveBeenCalled();
  });

  it('un paso en curso muestra EN CURSO y Finalizar, y Finalizar no abre el paso', () => {
    const p = props();
    renderWithProviders(<VisitaCard visita={armar({ over: { 1: { estado_visual: 'en_curso' } } })} profesionalDe={profesionalDe} {...p} />);

    expect(screen.getByText('EN CURSO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));

    expect(p.onFinalizarPaso).toHaveBeenCalledTimes(1);
    expect(p.onFinalizarPaso.mock.calls[0][0].id).toBe(1);
    expect(p.onAbrirPaso).not.toHaveBeenCalled();
  });

  it('el panel Cancelar cancela toda la visita', () => {
    const p = props();
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...p} />);

    fireEvent.click(screen.getByText('CANCELAR'));

    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it('en reposo deja asomar el panel Cancelar (-8px), como las demas tarjetas', () => {
    const { container } = renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...props()} />);

    expect((container.querySelector('[style*="translateX"]') as HTMLElement).style.transform).toBe('translateX(-8px)');
  });
});

describe('VisitaCard · WhatsApp', () => {
  it('muestra el enlace de WhatsApp en el encabezado cuando hay uno', () => {
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} whatsappHref="https://wa.me/549?text=hola" {...props()} />);

    expect(screen.getByRole('link', { name: 'Enviar recordatorio por WhatsApp' })).toHaveAttribute('href', 'https://wa.me/549?text=hola');
  });

  it('sin enlace no muestra el icono', () => {
    renderWithProviders(<VisitaCard visita={armar()} profesionalDe={profesionalDe} {...props()} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
