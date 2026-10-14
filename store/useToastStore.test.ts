import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast, useToastStore } from './useToastStore';

describe('showToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('a regular toast disappears after 2.5 seconds', () => {
    showToast('Cambios guardados');
    expect(useToastStore.getState().message).toBe('Cambios guardados');
    vi.advanceTimersByTime(2499);
    expect(useToastStore.getState().message).toBe('Cambios guardados');
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('a long toast stays long enough to read a full sentence', () => {
    showToast('Una frase más larga', { largo: true });
    vi.advanceTimersByTime(2500);
    expect(useToastStore.getState().message).toBe('Una frase más larga');
    vi.advanceTimersByTime(3500);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('a new toast replaces the current one and restarts the timer', () => {
    showToast('Primero');
    vi.advanceTimersByTime(2000);
    showToast('Segundo');
    vi.advanceTimersByTime(2000);
    expect(useToastStore.getState().message).toBe('Segundo');
  });
});
