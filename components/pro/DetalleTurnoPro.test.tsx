import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen, waitFor } from '@/test/render';
import { proService } from '@/services/proService';
import { cacheTurnosDia, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProTurno, ProVinculo } from '@/lib/pro/tipos';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/turnos/5', id: '5', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useParams: () => ({ id: nav.id }),
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
}));

import { DetalleTurnoPro } from './DetalleTurnoPro';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
  disponible: true,
  motivo: null,
});

function turno(extra: Partial<ProTurno> = {}): ProTurno {
  return {
    id: 5,
    fecha_hora: '2026-10-17T09:30:00',
    duracion_total_minutos: 90,
    estado_visual: 'confirmado',
    notas: null,
    cliente: { nombre: 'Lucía', apellido: 'Gómez' },
    servicios: [
      { id: 1, nombre: 'Esmaltado' },
      { id: 2, nombre: 'Pedicura' },
    ],
    promo: { id: 3, nombre: 'Promo de primavera' },
    ...extra,
  } as ProTurno;
}

const sinRed = (): Error => Object.assign(new Error('x'), { proError: { kind: 'network' } });
const noEncontrado = (): Error => Object.assign(new Error('x'), { proError: { kind: 'notFound' } });

beforeEach(() => {
  nav.pathname = '/turnos/5';
  nav.id = '5';
  nav.replace.mockReset();
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1), vinculo(2)], vinculoActivoId: 1, bloqueos: {} });
  useProAgendaStore.getState().reset();
  useProAgendaStore.getState().setFecha('2026-10-17');
});
afterEach(() => vi.restoreAllMocks());

describe('DetalleTurnoPro', () => {
  it('muestra fecha, horario, estado, cliente, servicios, promo y notas completas', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: 'Llega tarde\nTraer diseño' }));
    renderWithProviders(<DetalleTurnoPro />);

    expect(await screen.findByText('Lucía Gómez')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Detalle del turno' })).toHaveFocus();
    expect(screen.getByText(/17 de octubre de 2026/)).toBeInTheDocument();
    expect(screen.getByText('09:30 – 11:00')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Esmaltado')).toBeInTheDocument();
    expect(screen.getByText('Pedicura')).toBeInTheDocument();
    expect(screen.getByText('Promo de primavera')).toBeInTheDocument();
    expect(screen.getByText(/Llega tarde/)).toHaveTextContent('Llega tarde Traer diseño');
  });

  it('las notas son texto: pre-wrap, sin HTML ni enlaces', async () => {
    const hostil = '<img src=x onerror=alert(1)>\nhttps://ejemplo.com <script>x()</script>';
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: hostil }));
    const { container } = renderWithProviders(<DetalleTurnoPro />);

    const nota = await screen.findByTestId('detalle-notas');
    expect(nota.textContent).toBe(hostil);
    expect(nota.style.whiteSpace).toBe('pre-wrap');
    expect(nota).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('img, script, a[href^="http"]')).toBeNull();
    const fuente = readFileSync(join(__dirname, 'DetalleTurnoPro.tsx'), 'utf8');
    expect(fuente).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('sin notas muestra el aviso de que no hay', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: '   ' }));
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('Sin notas.')).toBeInTheDocument();
    expect(screen.queryByTestId('detalle-notas')).toBeNull();
  });

  it('turno inexistente: estado amable con enlace a la agenda', async () => {
    vi.spyOn(proService, 'turno').mockRejectedValue(noEncontrado());
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('No encontramos este turno. Puede que ya no exista.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la agenda' })).toHaveAttribute('href', '/agenda');
    expect(screen.queryByText('Lucía Gómez')).toBeNull();
  });

  it('en localhost el enlace de vuelta conserva el prefijo /pro', async () => {
    nav.pathname = '/pro/turnos/5';
    vi.spyOn(proService, 'turno').mockRejectedValue(noEncontrado());
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByRole('link', { name: 'Volver a la agenda' })).toHaveAttribute('href', '/pro/agenda');
  });

  it('un turno de otro negocio no aparece: se pide con el negocio activo y no se filtra nada', async () => {
    const pedir = vi.spyOn(proService, 'turno').mockRejectedValue(noEncontrado());
    useProAuthStore.setState({ vinculoActivoId: 2 });
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('No encontramos este turno. Puede que ya no exista.')).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledWith(2, 5, expect.any(AbortSignal));
    expect(screen.queryByText('Lucía Gómez')).toBeNull();
  });

  it.each(['abc', '0', '-3', '5/../me', '1e1', '', '2.5', '9007199254740993'])(
    'id inválido %j: no encontrado y ninguna petición',
    (id) => {
      nav.id = id;
      const pedir = vi.spyOn(proService, 'turno').mockResolvedValue(turno());
      renderWithProviders(<DetalleTurnoPro />);
      expect(screen.getByText('No encontramos este turno. Puede que ya no exista.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a la agenda' })).toBeInTheDocument();
      expect(pedir).not.toHaveBeenCalled();
    },
  );

  it('nunca muestra teléfono, precio, seña ni acciones, aunque el dato venga en la respuesta', async () => {
    const hostil = {
      ...turno(),
      telefono: '+54 9 11 5555-0000',
      precio_total: 12345,
      sena: 4242,
      pagos: [{ monto: 1 }],
      cliente: { nombre: 'Lucía', apellido: 'Gómez', telefono: '+54 9 11 5555-0000', whatsapp: 'wa' },
    } as unknown as ProTurno;
    vi.spyOn(proService, 'turno').mockResolvedValue(hostil);
    const { container } = renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Lucía Gómez');
    const html = container.innerHTML;
    expect(html).not.toMatch(/5555|12345|4242|tel:|sms:|mailto:|wa\.me|whatsapp/i);
    expect(screen.queryByRole('button', { name: /editar|cancelar|cobrar|whatsapp|llamar/i })).toBeNull();
    expect(container.querySelector('a[href^="tel:"], a[href^="sms:"], a[href^="mailto:"]')).toBeNull();
  });

  it('muestra al instante el turno de la lista del día; un error de refresco lo conserva con aviso', async () => {
    cacheTurnosDia.set('1:dia:2026-10-17', { turnos: [turno({ notas: 'resumen' })], truncated: false, descartados: 0 });
    vi.spyOn(proService, 'turno').mockRejectedValue(sinRed());
    renderWithProviders(<DetalleTurnoPro />);

    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    expect(await screen.findByText('Se muestra la última información', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    expect(screen.getByText('resumen')).toBeInTheDocument();
  });

  it('error sin datos: mensaje del tipo de error y reintento', async () => {
    const pedir = vi.spyOn(proService, 'turno').mockRejectedValueOnce(sinRed()).mockResolvedValue(turno());
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos');
    act(() => screen.getByRole('button', { name: 'Reintentar' }).click());
    expect(await screen.findByText('Lucía Gómez')).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('sin caché muestra el spinner mientras carga', async () => {
    vi.spyOn(proService, 'turno').mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DetalleTurnoPro />);
    expect(screen.getByRole('status', { name: 'Cargando turno' })).toBeInTheDocument();
  });

  it('al cambiar de negocio con el detalle abierto, se borra el dato y se vuelve a la agenda', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno());
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Lucía Gómez');

    act(() => useProAuthStore.setState({ vinculoActivoId: 2 }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/agenda'));
    expect(screen.queryByText('Lucía Gómez')).toBeNull();
  });
});
