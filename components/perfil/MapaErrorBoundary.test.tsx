import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { MapaErrorBoundary } from './MapaErrorBoundary';

function Bomba(): null {
  throw new Error('boom');
}

describe('MapaErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    renderWithProviders(
      <MapaErrorBoundary>
        <p>mapa ok</p>
      </MapaErrorBoundary>,
    );
    expect(screen.getByText('mapa ok')).toBeInTheDocument();
  });

  it('shows a fallback message instead of crashing when a child throws', () => {
    // React todavía loguea el error a console.error aunque lo capture el
    // boundary (comportamiento normal de React, no un bug) — se silencia acá
    // para no ensuciar la salida del test.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <MapaErrorBoundary>
        <Bomba />
      </MapaErrorBoundary>,
    );
    expect(screen.getByText('No pudimos cargar el mapa. Cerrá e intentá de nuevo.')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
