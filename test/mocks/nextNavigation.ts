import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

// Shared mock for `next/navigation`. App Router hooks (`useRouter`,
// `usePathname`, `useSearchParams`) have no jsdom implementation, so every
// component test replaces the module with this stub.
//
// Usage in a test file (the async factory dodges `vi.mock` hoisting — the
// factory must not close over module-scope imports):
//
//   import { setMockLocation, routerMock } from '@/test/mocks/nextNavigation';
//   vi.mock('next/navigation', async () =>
//     (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
//
// `usePathname` / `useSearchParams` are REACTIVE: calling `setMockLocation`
// (directly, or via a `routerMock.push` impl that forwards to it) re-renders
// the subscribed components, matching how Next's real router commits a
// navigation. Without this a test that pushes then asserts against the new
// path would never see the component re-resolve.

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

const locationState: { pathname: string; searchParams: URLSearchParams } = {
  pathname: '/',
  searchParams: new URLSearchParams(),
};

const listeners = new Set<() => void>();
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(): void {
  for (const cb of listeners) cb();
}

// Stable snapshots so `useSyncExternalStore` doesn't loop — only replaced when
// `setMockLocation` actually changes something.
let pathnameSnapshot = locationState.pathname;
let searchParamsSnapshot = locationState.searchParams;

export function setMockLocation(pathname: string, search = ''): void {
  const nextParams = new URLSearchParams(search);
  const changed =
    pathname !== locationState.pathname ||
    nextParams.toString() !== locationState.searchParams.toString();
  locationState.pathname = pathname;
  locationState.searchParams = nextParams;
  if (changed) {
    pathnameSnapshot = pathname;
    searchParamsSnapshot = nextParams;
    emit();
  }
}

export function resetNavigationMock(): void {
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.prefetch.mockReset();
  routerMock.back.mockReset();
  routerMock.forward.mockReset();
  routerMock.refresh.mockReset();
  listeners.clear();
  locationState.pathname = '/';
  locationState.searchParams = new URLSearchParams();
  pathnameSnapshot = '/';
  searchParamsSnapshot = locationState.searchParams;
}

export const nextNavigationMock = {
  useRouter: () => routerMock,
  usePathname: () => useSyncExternalStore(subscribe, () => pathnameSnapshot, () => pathnameSnapshot),
  useSearchParams: () =>
    useSyncExternalStore(subscribe, () => searchParamsSnapshot, () => searchParamsSnapshot),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
