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
  it('muestra etiqueta con fecha, cliente como título, horario, servicios y notas', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: 'Llega tarde\nTraer diseño' }));
    renderWithProviders(<DetalleTurnoPro />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Gómez' })).toHaveFocus();
    expect(screen.getByText(/17 de octubre de 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Turno ·/)).toBeNull();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('hasta las 11:00')).toBeInTheDocument();
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Idea para el turno' })).toBeInTheDocument();
    expect(screen.getByTestId('detalle-notas')).toHaveTextContent('Llega tarde Traer diseño');
    for (const etiqueta of ['Servicios', 'Hora', 'Hasta']) expect(screen.queryByText(etiqueta)).toBeNull();
  });

  it('muestra un servicio por línea, sin unirlos con " + "', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno());
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('Esmaltado')).toBeInTheDocument();
    expect(screen.getByText('Pedicura')).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).toBeNull();
  });

  it('con promo la palabra "Promo" aparece una sola vez, junto al nombre de la promo', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno());
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('Promo de primavera')).toBeInTheDocument();
    expect(screen.getAllByText('Promo')).toHaveLength(1);
  });

  it('sin promo no dibuja la franja de promo', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ promo: null }));
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Esmaltado');
    expect(screen.queryByText('Promo')).toBeNull();
  });

  it('si el turno termina al día siguiente conserva el aviso', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ fecha_hora: '2026-10-17T23:30:00' }));
    renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('hasta las 01:00')).toBeInTheDocument();
    expect(screen.getByText('día siguiente')).toBeInTheDocument();
  });

  it('el pie muestra "con {profesional}" del vínculo activo; sin dato no se dibuja', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno());
    const { unmount } = renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('con Ana')).toBeInTheDocument();
    unmount();
    vaciarCachesPro();
    useProAuthStore.setState({ vinculos: [] });
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Esmaltado');
    expect(screen.queryByText(/^con /)).toBeNull();
  });

  it('la píldora "En curso" aparece solo si el turno está en curso', async () => {
    const pedir = vi.spyOn(proService, 'turno').mockResolvedValue(turno({ estado_visual: 'en_curso' }));
    const { unmount } = renderWithProviders(<DetalleTurnoPro />);
    expect(await screen.findByText('En curso')).toBeInTheDocument();
    unmount();
    vaciarCachesPro();
    pedir.mockResolvedValue(turno());
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Lucía Gómez');
    expect(screen.queryByText('En curso')).toBeNull();
  });

  it('una nota larga se recorta con "Ver todo" y se expande y contrae', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: 'x'.repeat(200) }));
    renderWithProviders(<DetalleTurnoPro />);
    const nota = await screen.findByTestId('detalle-notas');
    expect(nota.style.webkitLineClamp).toBe('4');
    act(() => screen.getByRole('button', { name: 'Ver todo' }).click());
    expect(nota.style.webkitLineClamp).toBe('');
    act(() => screen.getByRole('button', { name: 'Ver menos' }).click());
    expect(nota.style.webkitLineClamp).toBe('4');
  });

  it('una nota corta no ofrece "Ver todo"', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: 'corta' }));
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByTestId('detalle-notas');
    expect(screen.queryByRole('button', { name: 'Ver todo' })).toBeNull();
  });

  it('las notas son texto: pre-wrap, sin HTML ni enlaces', async () => {
    const hostil = '<img src=x onerror=alert(1)>\nhttps://ejemplo.com <script>x()</script>';
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: hostil }));
    renderWithProviders(<DetalleTurnoPro />);

    const nota = await screen.findByTestId('detalle-notas');
    expect(nota.textContent).toBe(hostil);
    expect(nota.style.whiteSpace).toBe('pre-wrap');
    expect(nota).toHaveAttribute('dir', 'auto');
    expect(nota.querySelector('img, script, a[href^="http"]')).toBeNull();
    const fuente = readFileSync(join(__dirname, 'DetalleTurnoPro.tsx'), 'utf8');
    expect(fuente).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('sin notas no dibuja el bloque', async () => {
    vi.spyOn(proService, 'turno').mockResolvedValue(turno({ notas: '   ' }));
    renderWithProviders(<DetalleTurnoPro />);
    await screen.findByText('Lucía Gómez');
    expect(screen.queryByTestId('detalle-notas')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
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
