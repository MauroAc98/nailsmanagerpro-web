import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TextoDraggable } from './TextoDraggable';

// jsdom no implementa PointerEvent: sin esto los eventos llegan sin clientX/Y.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const item = { id: 't1', texto: 'Hola', x: 100, y: 200, fontSize: 14 };

function arrastrar(escala?: number) {
  const onMover = vi.fn();
  render(<TextoDraggable item={item} escala={escala} onMover={onMover} onResize={vi.fn()} onEditar={vi.fn()} />);
  const pastilla = screen.getByText('Hola').parentElement as HTMLElement;
  pastilla.setPointerCapture = vi.fn();
  pastilla.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(pastilla, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(pastilla, { pointerId: 1, clientX: 110, clientY: 60 });
  fireEvent.pointerUp(pastilla, { pointerId: 1, clientX: 110, clientY: 60 });
  return onMover;
}

describe('TextoDraggable', () => {
  it('sin escala el texto se mueve lo mismo que el dedo', () => {
    expect(arrastrar()).toHaveBeenCalledWith('t1', 200, 250);
  });

  it('con la vista previa escalada, el movimiento se pasa a coordenadas de la historia', () => {
    // Vista al doble de tamaño: 100px de dedo son 50px en la historia.
    expect(arrastrar(2)).toHaveBeenCalledWith('t1', 150, 225);
  });
});
