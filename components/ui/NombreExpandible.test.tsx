import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { NombreExpandible } from './NombreExpandible';

// El popover se detecta por su contenido, no con findByRole: la consulta por
// rol recorre el arbol de accesibilidad y en este entorno tarda minutos.
// Se consulta de forma sincrona: Base UI abre el popup dentro del mismo click,
// y waitFor/findBy* entran en un loop con el DOM del popover bajo jsdom.
const popup = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const abierto = () => {
  const el = popup();
  expect(el).not.toBeNull();
  return el as HTMLElement;
};

const NOMBRE = 'Esmaltado semipermanente con diseño a mano alzada y pedrería';

// jsdom no hace layout: scrollWidth/scrollHeight/clientWidth/clientHeight son 0.
// Se simula "recortado" / "entra completo" a nivel de prototipo de <p> (en HTMLElement entero, floating-ui del popover entra en un loop).
function simularMedidas({ scrollWidth, clientWidth, scrollHeight, clientHeight }: Record<string, number>) {
  const def = (prop: string, value: number) =>
    Object.defineProperty(HTMLParagraphElement.prototype, prop, { configurable: true, get: () => value });
  def('scrollWidth', scrollWidth);
  def('clientWidth', clientWidth);
  def('scrollHeight', scrollHeight);
  def('clientHeight', clientHeight);
}
const recortado = () => simularMedidas({ scrollWidth: 300, clientWidth: 120, scrollHeight: 80, clientHeight: 40 });
const entra = () => simularMedidas({ scrollWidth: 100, clientWidth: 120, scrollHeight: 20, clientHeight: 20 });

afterEach(() => {
  for (const p of ['scrollWidth', 'clientWidth', 'scrollHeight', 'clientHeight']) {
    delete (HTMLParagraphElement.prototype as unknown as Record<string, unknown>)[p];
  }
});

function montar(props: Partial<React.ComponentProps<typeof NombreExpandible>> = {}) {
  const alTocarPadre = vi.fn();
  const alTocarTouch = vi.fn();
  renderWithProviders(
    <div onClick={alTocarPadre} onTouchStart={alTocarTouch} onTouchMove={alTocarTouch} onTouchEnd={alTocarTouch}>
      <NombreExpandible texto={NOMBRE} {...props} />
    </div>,
  );
  return { alTocarPadre, alTocarTouch };
}

describe('NombreExpandible', () => {
  it('recortado: tocar el nombre abre un popover con el texto completo y NO llega al padre', async () => {
    recortado();
    const { alTocarPadre } = montar();
    fireEvent.click(screen.getByText(NOMBRE));
    const dialogo = abierto();
    expect(dialogo).toHaveTextContent(NOMBRE);
    expect(alTocarPadre).not.toHaveBeenCalled();
  });

  it('recortado: touchstart/move/end tampoco llegan al padre (no dispara el swipe)', () => {
    recortado();
    const { alTocarTouch } = montar();
    const el = screen.getByText(NOMBRE);
    fireEvent.touchStart(el, { touches: [{ clientX: 10 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 40 }] });
    fireEvent.touchEnd(el);
    expect(alTocarTouch).not.toHaveBeenCalled();
  });

  it('recortado: tocar fuera cierra el popover', async () => {
    recortado();
    montar();
    fireEvent.click(screen.getByText(NOMBRE));
    abierto();
    fireEvent.pointerDown(document.body); fireEvent.mouseDown(document.body); fireEvent.pointerUp(document.body); fireEvent.click(document.body);
    expect(popup()).toBeNull();
  });

  it('recortado en alto (line-clamp de 2 lineas) tambien cuenta como recortado', async () => {
    simularMedidas({ scrollWidth: 120, clientWidth: 120, scrollHeight: 60, clientHeight: 40 });
    montar({ lineas: 2 });
    fireEvent.click(screen.getByText(NOMBRE));
    expect(abierto()).toHaveTextContent(NOMBRE);
    // Abrir el popover en jsdom tarda ~5 s (floating-ui): el tope por defecto no alcanza.
  }, 30000);

  it('si entra completo: el toque llega al padre como siempre y no abre nada', async () => {
    entra();
    const { alTocarPadre, alTocarTouch } = montar();
    fireEvent.click(screen.getByText(NOMBRE));
    expect(alTocarPadre).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
    fireEvent.touchStart(screen.getByText(NOMBRE), { touches: [{ clientX: 10 }] });
    expect(alTocarTouch).toHaveBeenCalled();
  });

  it('con children muestra ese contenido pero el popover usa `texto`', async () => {
    recortado();
    montar({ texto: 'A + B', children: <em>A + B (y 1 mas)</em> });
    fireEvent.click(screen.getByText('A + B (y 1 mas)'));
    expect(abierto()).toHaveTextContent('A + B');
  }, 30000);

  it('una linea: nowrap + ellipsis; dos lineas: line-clamp 2', () => {
    entra();
    const { unmount } = renderWithProviders(<NombreExpandible texto="x" />);
    expect(screen.getByText('x').style.whiteSpace).toBe('nowrap');
    expect(screen.getByText('x').style.textOverflow).toBe('ellipsis');
    unmount();
    renderWithProviders(<NombreExpandible texto="y" lineas={2} />);
    const el = screen.getByText('y');
    expect(el.style.whiteSpace).not.toBe('nowrap');
    expect(el.style.webkitLineClamp).toBe('2');
  });
});
