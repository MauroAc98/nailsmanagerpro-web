import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { showToast, useToastStore } from '@/store/useToastStore';
import { ToastHost } from './ToastHost';

describe('ToastHost', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(() => useToastStore.setState({ message: null }));
    vi.useRealTimers();
  });

  it('shows the message', () => {
    render(<ToastHost />);
    act(() => showToast('Cambios guardados'));
    expect(screen.getByText('Cambios guardados')).toBeInTheDocument();
  });

  it('shows a long message in full: it wraps onto more lines instead of being cut with an ellipsis', () => {
    const largo =
      'Seña guardada. Lo que paga el cliente ya incluye lo que cobra Mercado Pago, así que a vos te llega completo el porcentaje.';
    render(<ToastHost />);
    act(() => showToast(largo, { largo: true }));
    const texto = screen.getByText(largo);
    expect(texto.style.whiteSpace).not.toBe('nowrap');
    expect(texto.style.textOverflow).not.toBe('ellipsis');
    expect(texto.style.overflow).not.toBe('hidden');
  });
});
