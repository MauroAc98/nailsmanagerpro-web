import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BottomSheet } from './BottomSheet';

// The content wrapper must stay natively scrollable at every snap point — a
// long list in a half-open sheet has to scroll, not get clipped. Regression
// guard against reverting to `overflowY: isExpanded ? 'auto' : 'hidden'`.
describe('BottomSheet content wrapper', () => {
  function contentWrapperOf(testId: string): HTMLElement {
    // children render inside the scroll wrapper
    return screen.getByTestId(testId).parentElement as HTMLElement;
  }

  it('is scrollable regardless of the resting snap index', () => {
    const { rerender } = render(
      <BottomSheet snapPoints={[0.3, 0.5, 0.8]} initialIndex={0} enablePanDownToClose={false}>
        <div data-testid="c">contenido</div>
      </BottomSheet>,
    );

    let wrapper = contentWrapperOf('c');
    expect(wrapper.style.overflowY).toBe('auto');
    expect(wrapper.style.touchAction).toBe('pan-y');

    // fully-expanded single snap — still auto, not a special case
    rerender(
      <BottomSheet snapPoints={[0.8]} initialIndex={0} enablePanDownToClose={false}>
        <div data-testid="c">contenido</div>
      </BottomSheet>,
    );
    wrapper = contentWrapperOf('c');
    expect(wrapper.style.overflowY).toBe('auto');
    expect(wrapper.style.touchAction).toBe('pan-y');
  });
});
