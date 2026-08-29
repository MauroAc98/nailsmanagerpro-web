// Single logging seam for auth lifecycle events — design decision D4.
//
// Called from `checkSubscription` sub-call failures, the axios interceptor
// unknown-code path, `handleSessionRevoked`, and the `logout` server failure.
// One place to later attach a breadcrumb / telemetry sink.
export function logAuthEvent(event: string, detail?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[auth] ' + event, detail ?? '');
    return;
  }
  // TODO breadcrumb sink — forward auth lifecycle events to a production
  // breadcrumb/telemetry sink (e.g. Sentry.addBreadcrumb) once one exists.
}
