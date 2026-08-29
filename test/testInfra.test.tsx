import { screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { renderWithProviders } from '@/test/render';
import { setMockLocation } from '@/test/mocks/nextNavigation';

// Kept smoke test for the test infrastructure (originally the Slice 1 spike).
// Proves the full stack works together:
//   - RTL rendering a `'use client'` component under jsdom
//   - real next-intl v4 (ESM) via NextIntlClientProvider + static `es` catalog
//   - mocked `next/navigation` deep import resolving under Vitest
// If this breaks, the RTL component tests in later slices cannot be trusted.
vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

function SpikeProbe() {
  const t = useTranslations('common');
  const pathname = usePathname();
  return (
    <div>
      <span data-testid="translated">{t('cargando')}</span>
      <span data-testid="pathname">{pathname}</span>
    </div>
  );
}

describe('test infrastructure smoke', () => {
  it('renders translated text from the real es catalog and the mocked pathname', () => {
    setMockLocation('/agenda/historia');

    renderWithProviders(<SpikeProbe />);

    expect(screen.getByTestId('translated')).toHaveTextContent('Cargando...');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/agenda/historia');
  });
});
