import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { VisorFotos } from './VisorFotos';

// Visor de fotos a pantalla completa, compartido por el editor de fotos del
// salon (FotosServicioEditor) y el detalle publico de un servicio
// (DetalleServicioScreen). Sin mockear ningun modulo: es un componente
// controlado (fotos + indiceInicial + onClose), todo lo demas es estado
// interno que se ejerce con eventos reales de puntero.
//
// jsdom no implementa PointerEvent ni setPointerCapture (mismo gap que
// documenta components/BottomSheet.test.tsx): sin este polyfill local,
// fireEvent.pointerDown/Move/Up cae a un Event generico sin clientX/
// pointerId, y el arrastre/doble-tap del visor (que dependen de esos
// campos) no se puede ejercer.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    }
    // @ts-expect-error - polyfill minimo, jsdom no trae PointerEvent
    window.PointerEvent = PointerEventPolyfill;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
  }
});

describe('VisorFotos', () => {
  const fotos = ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg', 'https://cdn.test/3.jpg'];

  it('muestra la foto del indice inicial', () => {
    const { container } = renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={1} onClose={() => {}} />);
    expect(container.querySelector('img')).toHaveAttribute('src', fotos[1]);
  });

  it('el boton cerrar llama a onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tocar el fondo (fuera de la foto) tambien cierra', () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={onClose} />);
    const fondo = getByTestId('visor-fotos-area');
    fireEvent.pointerDown(fondo, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(fondo, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un tap simple sobre la foto (no sobre el fondo) no cierra ni hace nada raro', () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={onClose} />);
    const img = container.querySelector('img') as HTMLImageElement;
    fireEvent.pointerDown(img, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(img, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('con mas de una foto muestra el contador "n / total"', () => {
    renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={() => {}} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('con una sola foto no muestra contador', () => {
    renderWithProviders(<VisorFotos fotos={[fotos[0]]} indiceInicial={0} onClose={() => {}} />);
    expect(screen.queryByText(/\/ 1/)).toBeNull();
  });

  it('un arrastre horizontal amplio pasa a la siguiente foto y actualiza el contador', () => {
    const { container } = renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={() => {}} />);
    const area = screen.getByTestId('visor-fotos-area');
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 200, clientY: 100 });
    expect(container.querySelector('img')).toHaveAttribute('src', fotos[1]);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('en la primera foto un arrastre hacia la derecha (retroceder) no la cambia (no hay para atras)', () => {
    const { container } = renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={() => {}} />);
    const area = screen.getByTestId('visor-fotos-area');
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 250, clientY: 100 });
    expect(container.querySelector('img')).toHaveAttribute('src', fotos[0]);
  });

  it('doble tap sobre la foto activa el estado ampliada (data-ampliada)', () => {
    renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={() => {}} />);
    const area = screen.getByTestId('visor-fotos-area');
    expect(area).toHaveAttribute('data-ampliada', 'false');

    fireEvent.pointerDown(area, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 150, clientY: 150 });

    expect(area).toHaveAttribute('data-ampliada', 'true');
  });

  it('un segundo doble tap vuelve a 1x', () => {
    renderWithProviders(<VisorFotos fotos={fotos} indiceInicial={0} onClose={() => {}} />);
    const area = screen.getByTestId('visor-fotos-area');
    const dobleTap = () => {
      fireEvent.pointerDown(area, { pointerId: 1, clientX: 150, clientY: 150 });
      fireEvent.pointerUp(area, { pointerId: 1, clientX: 150, clientY: 150 });
      fireEvent.pointerDown(area, { pointerId: 1, clientX: 150, clientY: 150 });
      fireEvent.pointerUp(area, { pointerId: 1, clientX: 150, clientY: 150 });
    };
    dobleTap();
    expect(area).toHaveAttribute('data-ampliada', 'true');
    dobleTap();
    expect(area).toHaveAttribute('data-ampliada', 'false');
  });

  it('soporta las baldosas placeholder del mock (via FotoTile)', () => {
    const { container } = renderWithProviders(
      <VisorFotos fotos={['placeholder:1']} indiceInicial={0} onClose={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-placeholder="1"]')).not.toBeNull();
  });
});
