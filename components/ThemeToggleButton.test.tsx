import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import { useThemeStore } from '@/store/useThemeStore';
import { ThemeToggleButton } from './ThemeToggleButton';

const renderBoton = () =>
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <ThemeToggleButton />
    </NextIntlClientProvider>,
  );

describe('ThemeToggleButton', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'system', resolvedTheme: 'light' });
  });

  it('en modo claro ofrece pasar a oscuro y lo aplica', () => {
    renderBoton();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toBeInTheDocument();
  });

  it('en modo oscuro ofrece volver a claro', () => {
    useThemeStore.setState({ theme: 'dark', resolvedTheme: 'dark' });
    renderBoton();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
