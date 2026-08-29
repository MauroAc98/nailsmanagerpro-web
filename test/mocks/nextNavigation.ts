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

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

// Module-level test vars the hooks read from. Mutate them via
// `setMockLocation` before rendering.
const locationState: { pathname: string; searchParams: URLSearchParams } = {
  pathname: '/',
  searchParams: new URLSearchParams(),
};

export function setMockLocation(pathname: string, search = ''): void {
  locationState.pathname = pathname;
  locationState.searchParams = new URLSearchParams(search);
}

export function resetNavigationMock(): void {
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.prefetch.mockReset();
  routerMock.back.mockReset();
  routerMock.forward.mockReset();
  routerMock.refresh.mockReset();
  setMockLocation('/', '');
}

export const nextNavigationMock = {
  useRouter: () => routerMock,
  usePathname: () => locationState.pathname,
  useSearchParams: () => locationState.searchParams,
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
