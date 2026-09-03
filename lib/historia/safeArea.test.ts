import { describe, it, expect } from 'vitest';
import {
  safeAreaInsets,
  SAFE_INSET_TOP_RATIO,
  SAFE_INSET_BOTTOM_RATIO,
} from './safeArea';

describe('safeAreaInsets', () => {
  it('keeps content clear of the top and bottom platform chrome on the 1920px export', () => {
    const { top, bottom } = safeAreaInsets(1920);
    expect(top).toBe(Math.round(1920 * SAFE_INSET_TOP_RATIO));
    expect(bottom).toBe(Math.round(1920 * SAFE_INSET_BOTTOM_RATIO));
  });

  it('reserves more room at the bottom than the top (the reply/send bar is taller than the header)', () => {
    const { top, bottom } = safeAreaInsets(1920);
    expect(bottom).toBeGreaterThan(top);
  });

  it('scales with the canvas height so the ratio holds for preview and export alike', () => {
    const preview  = safeAreaInsets(640);
    const exported = safeAreaInsets(1920);
    expect(exported.top / preview.top).toBeCloseTo(3, 1);
    expect(exported.bottom / preview.bottom).toBeCloseTo(3, 1);
  });

  it('leaves at least ~55% of the canvas usable for content', () => {
    const h = 1920;
    const { top, bottom } = safeAreaInsets(h);
    expect(h - top - bottom).toBeGreaterThan(h * 0.55);
  });

  it('returns zero insets for a not-yet-measured canvas', () => {
    expect(safeAreaInsets(0)).toEqual({ top: 0, bottom: 0 });
    expect(safeAreaInsets(Number.NaN)).toEqual({ top: 0, bottom: 0 });
    expect(safeAreaInsets(-100)).toEqual({ top: 0, bottom: 0 });
  });
});
