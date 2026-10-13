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

function touchDrag(el: HTMLElement, fromY: number, toY: number) {
  fireEvent.touchStart(el, { touches: [{ clientY: fromY }] });
  fireEvent.touchMove(el, { touches: [{ clientY: (fromY + toY) / 2 }] });
  fireEvent.touchMove(el, { touches: [{ clientY: toY }] });
  fireEvent.touchEnd(el, { touches: [] });
}

describe('BottomSheet touch on content', () => {
  it('drags the sheet when a scrollable list is at its top and the finger pulls down', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 2000, 500);
    touchDrag(wrapper, 300, 500);
    expect(onChange).toHaveBeenCalled();
  });

  it('leaves a scrollable list to native scroll when it is scrolled down', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 2000, 500);
    (wrapper as unknown as { scrollTop: number }).scrollTop = 300;
    touchDrag(wrapper, 300, 500);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a scrollable list to native scroll when the finger goes up', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 2000, 500);
    touchDrag(wrapper, 500, 300);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drags the sheet on touch when the list has nothing to scroll', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 400, 500);
    touchDrag(wrapper, 500, 300);
    expect(onChange).toHaveBeenCalled();
  });

  it('ignores a mostly-horizontal swipe (card swipe) even with some vertical drift', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 400, 500);
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 500 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientX: 250, clientY: 510 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientX: 150, clientY: 530 }] });
    fireEvent.touchEnd(wrapper, { touches: [] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps (does not stay stuck) when the browser cancels the gesture', () => {
    const { wrapper, onChange } = renderSheet();
    setScrollable(wrapper, 400, 500);
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 500 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 460 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 400 }] });
    fireEvent.touchCancel(wrapper, { touches: [] });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('BottomSheet viewport resize', () => {
  it('adjusts instantly (no leftover snap transition) when the viewport height changes', () => {
    const { wrapper } = renderSheet();
    const sheet = wrapper.parentElement as HTMLElement;
    sheet.style.transition = 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
    fireEvent(window, new Event('resize'));
    expect(sheet.style.transition).toBe('none');
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });
});

describe('BottomSheet handle', () => {
  it('snaps on pointercancel instead of staying stuck mid-drag', () => {
    const { wrapper, onChange } = renderSheet();
    const handle = wrapper.previousElementSibling as HTMLElement;
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 440 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
  });
});
