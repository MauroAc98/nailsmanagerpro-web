import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { ListaServiciosBase, ServiciosHojaBase } from './ServiciosSheetBase';

const textos = {
  todosLabel: 'Todos',
  sinCategoriaLabel: 'Sin categoría',
  expandLabel: 'Expandir categoría',
  collapseLabel: 'Contraer categoría',
  ariaLabel: 'Servicio',
};

const planos = [{ id: 3, nombre: 'Esmaltado' }, { id: 4, nombre: 'Pedicura' }];

describe('ListaServiciosBase', () => {
  it('sin grupos: "Todos" arriba y un servicio por fila, sin encabezados', () => {
    renderWithProviders(<ListaServiciosBase {...textos} servicios={planos} grupos={null} seleccionadoId={null} onElegir={vi.fn()} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Servicio' });
    expect(within(grupo).getAllByRole('radio').map(r => r.textContent)).toEqual(['Todos', 'Esmaltado', 'Pedicura']);
    expect(screen.queryByRole('button', { name: 'Contraer categoría' })).toBeNull();
  });

  it('marca solo el elegido y llama onElegir con el id o con null', () => {
    const onElegir = vi.fn();
    renderWithProviders(<ListaServiciosBase {...textos} servicios={planos} grupos={null} seleccionadoId={4} onElegir={onElegir} />);
    expect(screen.getByRole('radio', { name: 'Pedicura' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Todos' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Esmaltado' }));
    expect(onElegir).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(onElegir).toHaveBeenLastCalledWith(null);
  });

  it('hideTodos omite la fila "Todos"', () => {
    renderWithProviders(<ListaServiciosBase {...textos} hideTodos servicios={planos} grupos={null} seleccionadoId={null} onElegir={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Todos' })).toBeNull();
  });

  it('con grupos: encabezado por categoría, "Sin categoría" y colapso independiente', () => {
    const grupos = [
      { id: 1, nombre: 'Manos', servicios: [planos[0]] },
      { id: null, nombre: '', servicios: [planos[1]] },
    ];
    renderWithProviders(
      <ListaServiciosBase {...textos} servicios={planos} grupos={grupos} seleccionadoId={null} onElegir={vi.fn()}
        detalle={s => <span>{`det-${s.id}`}</span>} fotoCategoria={id => (id === 1 ? '/foto.png' : null)} />,
    );
    expect(screen.getByText('Manos')).toBeInTheDocument();
    expect(screen.getByText('Sin categoría')).toBeInTheDocument();
    expect(screen.getByText('det-3')).toBeInTheDocument();
    const colapsar = screen.getAllByRole('button', { name: 'Contraer categoría' });
    expect(colapsar).toHaveLength(2);
    fireEvent.click(colapsar[0]);
    expect(screen.queryByRole('radio', { name: /Esmaltado/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Pedicura/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir categoría' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('ServiciosHojaBase', () => {
  const montar = (props: Partial<React.ComponentProps<typeof ServiciosHojaBase>> = {}) => {
    const onClose = vi.fn();
    const vista = renderWithProviders(
      <ServiciosHojaBase title="Servicio" closeLabel="Cerrar" onClose={onClose} backdropTestId="fondo" {...props}>
        <p>contenido</p>
      </ServiciosHojaBase>,
    );
    return { ...vista, onClose };
  };

  it('diálogo con título, cuerpo y botón de cierre; Escape y el fondo también cierran', () => {
    const { onClose } = montar();
    const dialogo = screen.getByRole('dialog', { name: 'Servicio' });
    expect(within(dialogo).getByText('contenido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('fondo'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('el fondo usa backdropZIndex y la hoja el zIndex recibido', () => {
    montar({ backdropZIndex: 61, zIndex: 62 });
    expect(screen.getByTestId('fondo').style.zIndex).toBe('61');
    expect(screen.getByRole('dialog').closest('[style*="z-index: 62"]')).not.toBeNull();
  });
});
