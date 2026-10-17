import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { ServicioFiltroSheet } from './ServicioFiltroSheet';

const vinculo: ProVinculo = {
  id: 1,
  negocioNombre: 'Negocio 1',
  profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
  disponible: true,
  motivo: null,
};

const servicios = {
  servicios: [
    { id: 3, nombre: 'Esmaltado', duracion_minutos: null, categoria: null },
    { id: 4, nombre: 'Pedicura', duracion_minutos: null, categoria: null },
  ],
  descartados: 0,
};
const serviciosConCategoria = {
  servicios: [
    { id: 3, nombre: 'Esmaltado', duracion_minutos: 45, categoria: { id: 7, nombre: 'Manos' } },
    { id: 4, nombre: 'Pedicura', duracion_minutos: 90, categoria: { id: 8, nombre: 'Pies' } },
    { id: 5, nombre: 'Cejas', duracion_minutos: 30, categoria: null },
  ],
  descartados: 0,
};

function montar(props: Partial<React.ComponentProps<typeof ServicioFiltroSheet>> = {}) {
  const acciones = { onElegir: vi.fn(), onCerrar: vi.fn() };
  const vista = renderWithProviders(<ServicioFiltroSheet abierto seleccionado={null} {...acciones} {...props} />);
  return { ...vista, ...acciones };
}

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo], vinculoActivoId: 1, bloqueos: {} });
  vi.spyOn(proService, 'servicios').mockResolvedValue(servicios);
});
afterEach(() => vi.restoreAllMocks());

describe('ServicioFiltroSheet', () => {
  it('cerrada no pide ni pinta nada', () => {
    const { container } = montar({ abierto: false });
    expect(container).toBeEmptyDOMElement();
    expect(proService.servicios).not.toHaveBeenCalled();
  });

  it('abierta lista "Todos" arriba y un servicio por fila, en un diálogo con el título del servicio', async () => {
    montar();
    const dialogo = screen.getByRole('dialog', { name: 'Servicio' });
    await within(dialogo).findByRole('radio', { name: 'Pedicura' });
    expect(within(dialogo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Todos', 'Esmaltado', 'Pedicura']);
  });

  it('sin categorías ni duración en la respuesta sigue siendo una lista plana, sin encabezados', async () => {
    montar();
    await screen.findByRole('radio', { name: 'Pedicura' });
    expect(screen.queryByRole('button', { name: /categoría/i })).toBeNull();
    expect(screen.queryByText(/min$/)).toBeNull();
  });

  it('con categorías agrupa por encabezado, deja "Sin categoría" al final y muestra la duración', async () => {
    vi.spyOn(proService, 'servicios').mockResolvedValue(serviciosConCategoria);
    montar();
    const dialogo = screen.getByRole('dialog', { name: 'Servicio' });
    await within(dialogo).findByRole('radio', { name: /Pedicura/ });
    expect(within(dialogo).getByText('Manos')).toBeInTheDocument();
    expect(within(dialogo).getByText('Pies')).toBeInTheDocument();
    expect(within(dialogo).getByText('Sin categoría')).toBeInTheDocument();
    expect(within(dialogo).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Todos',
      'Esmaltado45 min',
      'Pedicura1 h 30 min',
      'Cejas30 min',
    ]);
    expect(within(dialogo).getAllByRole('button', { name: 'Colapsar categoría' })).toHaveLength(3);
  });

  it('elegir un servicio agrupado devuelve su id', async () => {
    vi.spyOn(proService, 'servicios').mockResolvedValue(serviciosConCategoria);
    const { onElegir } = montar();
    fireEvent.click(await screen.findByRole('radio', { name: /Cejas/ }));
    expect(onElegir).toHaveBeenLastCalledWith(5);
  });

  it('marca como elegido solo el servicio seleccionado; sin selección, "Todos"', async () => {
    const { rerender } = montar({ seleccionado: 4 });
    await screen.findByRole('radio', { name: 'Pedicura' });
    expect(screen.getByRole('radio', { name: 'Pedicura' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Esmaltado' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Todos' })).not.toBeChecked();
    rerender(<ServicioFiltroSheet abierto seleccionado={null} onElegir={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeChecked();
  });

  it('tocar un servicio lo elige (selección única); "Todos" elige null', async () => {
    const { onElegir } = montar({ seleccionado: 3 });
    fireEvent.click(await screen.findByRole('radio', { name: 'Pedicura' }));
    expect(onElegir).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(onElegir).toHaveBeenLastCalledWith(null);
  });

  it('Cerrar y Escape cierran sin elegir', async () => {
    const { onCerrar, onElegir } = montar();
    await screen.findByRole('radio', { name: 'Pedicura' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(2);
    expect(onElegir).not.toHaveBeenCalled();
  });

  it('el zIndex de la hoja y de su fondo es el recibido (por encima de otra hoja)', () => {
    montar({ zIndex: 62 });
    expect(screen.getByTestId('fondo-servicio').style.zIndex).toBe('61');
    expect(screen.getByRole('dialog').closest('[style*="z-index: 62"]')).not.toBeNull();
  });
});
