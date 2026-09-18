// Agenda home screen — only the highest-priority applicable attention banner
// renders at a time (redesign Change 2). Priority order: suscripción >
// cobros pendientes > recordatorios. Pure function so the priority/dismiss
// logic itself is unit-testable without mounting any component or store.
//
// A dismissed banner is skipped for the rest of the session, but a
// dismissal is scoped to its OWN priority slot — it never blocks a
// higher-priority banner that becomes applicable later in the same session.
export type BannerKey = 'subscription' | 'cobros' | 'recordatorios';

export const BANNER_PRIORITY: readonly BannerKey[] = ['subscription', 'cobros', 'recordatorios'];

export function pickVisibleBanner(
  visible: Record<BannerKey, boolean>,
  dismissed: Record<BannerKey, boolean>,
): BannerKey | null {
  for (const key of BANNER_PRIORITY) {
    if (visible[key] && !dismissed[key]) return key;
  }
  return null;
}
