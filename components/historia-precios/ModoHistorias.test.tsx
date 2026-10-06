import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ModoHistorias } from './ModoHistorias';

function setup(props: Partial<React.ComponentProps<typeof ModoHistorias>> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <ModoHistorias modo="una" onChange={onChange} cantidadServicios={5} cantidadHistorias={3} entra {...props} />,
  );
  return onChange;
}
const cardUna = () => screen.getByRole('button', { name: /Una historia/ });
const cardCat = () => screen.getByRole('button', { name: /Una por categoría/ });

describe('ModoHistorias', () => {
  it('muestra título, ambas tarjetas y marca la activa con aria-pressed', () => {
    setup();
    expect(screen.getByText('¿Cómo querés armarla?')).toBeTruthy();
    expect(cardUna().getAttribute('aria-pressed')).toBe('true');
    expect(cardCat().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Todo junto en una sola imagen.')).toBeTruthy();
    expect(screen.getByText('Una imagen por cada categoría que elegiste.')).toBeTruthy();
  });

  it('click en una tarjeta pide ese modo', () => {
    const onChange = setup();
    fireEvent.click(cardCat());
    expect(onChange).toHaveBeenCalledWith('categoria');
    fireEvent.click(cardUna());
    expect(onChange).toHaveBeenCalledWith('una');
  });

  it('líneas en vivo con plural', () => {
    setup({ cantidadServicios: 5, cantidadHistorias: 3 });
    expect(screen.getByText('5 servicios elegidos')).toBeTruthy();
    expect(screen.getByText('3 historias para compartir.')).toBeTruthy();
  });

  it('singular con uno', () => {
    setup({ cantidadServicios: 1, cantidadHistorias: 1 });
    expect(screen.getByText('1 servicio elegido')).toBeTruthy();
    expect(screen.getByText('1 historia para compartir.')).toBeTruthy();
  });

  it('sin servicios pide elegir al menos uno en ambas tarjetas', () => {
    setup({ cantidadServicios: 0, cantidadHistorias: 0 });
    expect(screen.getAllByText('Elegí al menos un servicio.')).toHaveLength(2);
  });

  it('muestra "Recomendado" solo en modo una y cuando no entra', () => {
    setup({ modo: 'una', entra: false });
    expect(screen.getAllByText('Recomendado')).toHaveLength(1);
    expect(cardCat().textContent).toContain('Recomendado');
    expect(cardUna().textContent).not.toContain('Recomendado');
  });

  it('sin badge si entra', () => {
    setup({ modo: 'una', entra: true });
    expect(screen.queryByText('Recomendado')).toBeNull();
  });

  it('sin badge en modo categoría aunque no entre', () => {
    setup({ modo: 'categoria', entra: false });
    expect(screen.queryByText('Recomendado')).toBeNull();
  });
});
