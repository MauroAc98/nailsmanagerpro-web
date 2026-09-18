import { describe, expect, it } from 'vitest';
import { pickVisibleBanner } from './bannerPriority';

const none = { subscription: false, cobros: false, recordatorios: false };

describe('pickVisibleBanner', () => {
  it('returns null when nothing is visible', () => {
    expect(pickVisibleBanner(none, none)).toBeNull();
  });

  it('prioritizes subscription over cobros and recordatorios', () => {
    const visible = { subscription: true, cobros: true, recordatorios: true };
    expect(pickVisibleBanner(visible, none)).toBe('subscription');
  });

  it('falls back to cobros when subscription is not visible', () => {
    const visible = { subscription: false, cobros: true, recordatorios: true };
    expect(pickVisibleBanner(visible, none)).toBe('cobros');
  });

  it('falls back to recordatorios when only it is visible', () => {
    const visible = { subscription: false, cobros: false, recordatorios: true };
    expect(pickVisibleBanner(visible, none)).toBe('recordatorios');
  });

  it('skips a dismissed banner in favor of the next applicable one', () => {
    const visible = { subscription: true, cobros: true, recordatorios: true };
    const dismissed = { subscription: true, cobros: false, recordatorios: false };
    expect(pickVisibleBanner(visible, dismissed)).toBe('cobros');
  });

  it('a dismissal never blocks a higher-priority banner that becomes visible later', () => {
    const visible = { subscription: true, cobros: false, recordatorios: false };
    // cobros was dismissed earlier in the session while it was the winner;
    // subscription later becomes applicable and must still win, unaffected
    // by cobros' own dismissed-for-the-session state.
    const dismissed = { subscription: false, cobros: true, recordatorios: false };
    expect(pickVisibleBanner(visible, dismissed)).toBe('subscription');
  });

  it('returns null when every applicable banner has been dismissed', () => {
    const visible = { subscription: true, cobros: true, recordatorios: false };
    const dismissed = { subscription: true, cobros: true, recordatorios: false };
    expect(pickVisibleBanner(visible, dismissed)).toBeNull();
  });
});
