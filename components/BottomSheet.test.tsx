import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { BottomSheet } from './BottomSheet';

beforeAll(() => {
  // jsdom ships no pointer-capture; the sheet drag calls it.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
  }
  // jsdom has no layout — give window a height so availableHeight > 0.
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

function renderSheet(onChange = vi.fn()) {
  render(
    <BottomSheet snapPoints={[0.3, 0.5, 0.8]} initialIndex={0} enablePanDownToClose={false} onChange={onChange}>
      <div data-testid="c">contenido</div>
    </BottomSheet>,
  );
  const wrapper = screen.getByTestId('c').parentElement as HTMLElement;
  return { wrapper, onChange };
}

function setScrollable(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true });
}

function dragUp(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerId: 1, clientY: 500 });
  fireEvent.pointerMove(el, { pointerId: 1, clientY: 460 });
  fireEvent.pointerMove(el, { pointerId: 1, clientY: 300 });
  fireEvent.pointerUp(el, { pointerId: 1, clientY: 300 });
}

describe('BottomSheet content wrapper', () => {
  it('is natively scrollable at every snap (regression: was overflow:hidden below the top snap)', () => {
    const { wrapper } = renderSheet();
    expect(wrapper.style.overflowY).toBe('auto');
    expect(wrapper.style.touchAction).toBe('pan-y');
  });

  it('does NOT drag the sheet when the content list can scroll', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 2000, 500); // long list
    dragUp(wrapper);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drags the sheet when the content has nothing to scroll', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 400, 500); // fits — nothing to scroll
    dragUp(wrapper);
    expect(onChange).toHaveBeenCalled();
  });
});
