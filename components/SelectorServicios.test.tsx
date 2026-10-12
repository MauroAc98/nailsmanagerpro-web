import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));

import type { Servicio } from '@/services/servicioService';
import { SelectorServicios } from './SelectorServicios';

const servicio = (id: number, nombre: string, duracion_minutos: number): Servicio =>
  ({ id, user_id: 1, nombre, duracion_minutos, precio: '5000', activo: true, es_promo: false, orden: id, categoria_id: null, created_at: '', updated_at: '' }) as Servicio;

describe('SelectorServicios — duración', () => {
  const servicios = [
    servicio(1, 'Softgel', 90),
    servicio(2, 'Esmaltado', 45),
    servicio(3, 'Pedicura', 120),
    servicio(4, 'Retiro', 60),
  ];

  it('muestra la duración en horas y minutos, como se lee de siempre, no en minutos totales', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} />);

    expect(await screen.findByText('1 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('2 h')).toBeInTheDocument();
    expect(screen.getByText('1 h')).toBeInTheDocument();
  });

  it('no queda ningún "90 min" ni "120 min" en minutos totales', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} />);
    await screen.findByText('Softgel');

    expect(screen.queryByText('90 min')).not.toBeInTheDocument();
    expect(screen.queryByText('120 min')).not.toBeInTheDocument();
    expect(screen.queryByText('60 min')).not.toBeInTheDocument();
  });
});

describe('SelectorServicios — detalle', () => {
  const servicios = [servicio(1, 'Softgel', 90), servicio(2, 'Esmaltado', 45)];

  it('con detalle reemplaza la duración por lo que devuelve', async () => {
    renderWithProviders(
      <SelectorServicios
        servicios={servicios}
        mode="multi"
        selectedIds={[]}
        onChange={vi.fn()}
        detalle={s => <span>{`$${s.id}000`}</span>}
      />,
    );
    expect(await screen.findByText('$1000')).toBeInTheDocument();
    expect(screen.getByText('$2000')).toBeInTheDocument();
    expect(screen.queryByText('1 h 30 min')).not.toBeInTheDocument();
    expect(screen.queryByText('45 min')).not.toBeInTheDocument();
  });
});

describe('SelectorServicios — todosLabel (multi)', () => {
  const servicios = [servicio(1, 'Softgel', 90), servicio(2, 'Esmaltado', 45)];

  it('no muestra fila "todos" si no se pasa todosLabel', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} />);
    await screen.findByText('Softgel');
    expect(screen.queryByText('Todos los servicios')).not.toBeInTheDocument();
  });

  it('muestra la fila y la tilda cuando no hay selección', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} todosLabel="Todos los servicios" />);
    const fila = (await screen.findByText('Todos los servicios')).closest('button')!;
    expect(fila.querySelector('svg')).not.toBeNull();
  });

  it('la fila no está tildada cuando hay selección', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[1]} onChange={vi.fn()} todosLabel="Todos los servicios" />);
    const fila = (await screen.findByText('Todos los servicios')).closest('button')!;
    expect(fila.querySelector('svg')).toBeNull();
  });

  it('tocarla limpia la selección', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[1, 2]} onChange={onChange} todosLabel="Todos los servicios" />);
    fireEvent.click(await screen.findByText('Todos los servicios'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('SelectorServicios — fotoCategoria', () => {
  it('muestra la miniatura de la categoría y no la de "Sin categoría"', async () => {
    const { categoriaServicioService } = await import('@/services/categoriaServicioService');
    vi.mocked(categoriaServicioService.getAll).mockResolvedValue([
      { id: 10, user_id: 1, nombre: 'Uñas', fondo_historia_url: null, created_at: '', updated_at: '' },
    ]);
    const servicios = [
      { ...servicio(1, 'Softgel', 90), categoria_id: 10 },
      servicio(2, 'Cejas', 30),
    ];
    const fotoCategoria = vi.fn((id: number) => `https://x/${id}.jpg`);
    const { container } = renderWithProviders(
      <SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} fotoCategoria={fotoCategoria} />,
    );
    await screen.findByText('Softgel');
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('https://x/10.jpg');
    expect(imgs[0].getAttribute('alt')).toBe('');
    expect(fotoCategoria).not.toHaveBeenCalledWith(null);
    vi.mocked(categoriaServicioService.getAll).mockResolvedValue([]);
  });

  it('sin la prop no hay imágenes', async () => {
    const { container } = renderWithProviders(<SelectorServicios servicios={[servicio(1, 'Softgel', 90)]} mode="multi" selectedIds={[]} onChange={vi.fn()} />);
    await screen.findByText('Softgel');
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});
