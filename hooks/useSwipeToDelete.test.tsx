import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useSwipeToDelete, SWIPE_PEEK, SWIPE_REVEAL } from './useSwipeToDelete';

function Harness({ onTap }: { onTap?: () => void }) {
  const { cardRef, handlers } = useSwipeToDelete({ onTap });
  return <div data-testid="card" ref={cardRef} style={{ transform: `translateX(${-SWIPE_PEEK}px)` }} {...handlers} />;
}

function swipe(el: HTMLElement, fromX: number, toX: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: fromX }] });
  fireEvent.touchMove(el, { touches: [{ clientX: toX }] });
  fireEvent.touchEnd(el);
}

describe('useSwipeToDelete', () => {
  it('exposes the same constants as the standard cards', () => {
    expect(SWIPE_PEEK).toBe(8);
    expect(SWIPE_REVEAL).toBe(80);
  });

  it('rests at the peek offset and does not change on mount', () => {
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('card').style.transform).toBe('translateX(-8px)');
  });

  it('follows the finger 1:1 while dragging, clamped to the reveal width', () => {
    const { getByTestId } = render(<Harness />);
    const el = getByTestId('card');
    fireEvent.touchStart(el, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 170 }] });
    expect(el.style.transform).toBe('translateX(-38px)');
    expect(el.style.transition).toBe('none');
    fireEvent.touchMove(el, { touches: [{ clientX: 0 }] });
    expect(el.style.transform).toBe('translateX(-80px)');
  });

  it('snaps open past the threshold, with the snap animation', () => {
    const { getByTestId } = render(<Harness />);
    const el = getByTestId('card');
    swipe(el, 200, 130);
    expect(el.style.transform).toBe('translateX(-80px)');
    expect(el.style.transition).toContain('0.32s');
  });

  it('snaps back to the peek when released before the threshold', () => {
    const { getByTestId } = render(<Harness />);
    const el = getByTestId('card');
    swipe(el, 200, 170);
    expect(el.style.transform).toBe('translateX(-8px)');
  });

  it('a tap while closed runs onTap', () => {
    const onTap = vi.fn();
    const { getByTestId } = render(<Harness onTap={onTap} />);
    fireEvent.click(getByTestId('card'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('a click while open only closes the panel, without onTap', () => {
    const onTap = vi.fn();
    const { getByTestId } = render(<Harness onTap={onTap} />);
    const el = getByTestId('card');
    swipe(el, 200, 130);
    // Un click sintético posterior al drag se ignora (dragged), igual que GastoCard.
    fireEvent.touchStart(el, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(el);
    fireEvent.click(el);
    expect(onTap).not.toHaveBeenCalled();
    expect(el.style.transform).toBe('translateX(-8px)');
  });

  it('the click that follows a drag is ignored', () => {
    const onTap = vi.fn();
    const { getByTestId } = render(<Harness onTap={onTap} />);
    const el = getByTestId('card');
    swipe(el, 200, 170);
    fireEvent.click(el);
    expect(onTap).not.toHaveBeenCalled();
  });
});
