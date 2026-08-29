import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';

// next-intl is NOT mocked. Tests render through the real
// `NextIntlClientProvider` with the static `es` catalog (the same object the
// app ships as the default locale and fallback), so `useTranslations` resolves
// exactly the strings users see. Locale-specific catalogs (`pt-BR`) load
// async in the app; tests only need the synchronous `es` source of truth.
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

type ProviderOptions = {
  locale?: string;
} & Omit<RenderOptions, 'wrapper'>;

export function renderWithProviders(
  ui: ReactElement,
  { locale = 'es', ...renderOptions }: ProviderOptions = {},
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={es} timeZone={TIME_ZONE}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
