import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { PieContacto } from './PieContacto';

describe('PieContacto', () => {
  it('muestra la etiqueta, el nombre a la izquierda y el teléfono a la derecha, sin guion', () => {
    renderWithProviders(<PieContacto nombre="Salón Luz" telefono="5491155550000" />);
    const cta = screen.getByText('Reservá tu turno');
    const nombre = screen.getByText('Salón Luz');
    const tel = screen.getByText(/^\+/);
    expect(cta.parentElement?.style.textTransform).toBe('uppercase');
    expect(screen.queryByText('—')).toBeNull();
    expect(cta.compareDocumentPosition(nombre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nombre.compareDocumentPosition(tel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tel.style.whiteSpace).toBe('nowrap');
    expect(tel.style.fontWeight).toBe('600');
  });

  it('sin nombre, el teléfono ocupa su lugar debajo de la etiqueta y no se repite a la derecha', () => {
    renderWithProviders(<PieContacto nombre={null} telefono="5491155550000" />);
    expect(screen.getAllByText(/^\+/)).toHaveLength(1);
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
