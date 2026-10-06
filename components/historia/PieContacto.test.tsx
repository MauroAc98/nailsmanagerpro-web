import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { PieContacto } from './PieContacto';

describe('PieContacto', () => {
  it('muestra CTA, nombre, guion largo y teléfono en una sola línea', () => {
    renderWithProviders(<PieContacto nombre="Salón Luz" telefono="5491155550000" />);
    expect(screen.getByText('Reservá tu turno')).toBeTruthy();
    expect(screen.getByText('Salón Luz')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    const tel = screen.getByText(/^\+/);
    expect(tel.style.whiteSpace).toBe('nowrap');
    expect(tel.style.fontWeight).toBe('600');
  });

  it('solo nombre: sin guion ni teléfono', () => {
    renderWithProviders(<PieContacto nombre="Salón Luz" telefono={null} />);
    expect(screen.getByText('Salón Luz')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('solo teléfono: sin nombre ni guion', () => {
    renderWithProviders(<PieContacto nombre={null} telefono="5491155550000" />);
    expect(screen.getByText(/^\+/)).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('sin nombre ni teléfono: solo el CTA', () => {
    renderWithProviders(<PieContacto nombre="" telefono="" />);
    expect(screen.getByText('Reservá tu turno')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('expone los refs de la línea divisoria y del pie', () => {
    const lineaRef = createRef<HTMLDivElement>();
    const pieRef = createRef<HTMLDivElement>();
    renderWithProviders(<PieContacto nombre="X" telefono={null} lineaRef={lineaRef} pieRef={pieRef} />);
    expect(lineaRef.current?.style.height).toBe('1px');
    expect(pieRef.current?.textContent).toContain('Reservá tu turno');
  });
});
