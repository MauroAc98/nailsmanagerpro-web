import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClienteConTelefono } from './ClienteConTelefono';

const marta = { nombre: 'Marta', apellido: 'Rios', telefono: '+543765252395' };

describe('ClienteConTelefono', () => {
  it('en la lista muestra el nombre y, debajo, el teléfono para distinguir homónimos', () => {
    render(<ClienteConTelefono cliente={marta} variante="fila" />);

    expect(screen.getByText('Marta Rios')).toBeInTheDocument();
    expect(screen.getByText('+543765252395')).toBeInTheDocument();
  });

  it('en el campo muestra nombre y teléfono juntos', () => {
    render(<ClienteConTelefono cliente={marta} variante="campo" />);

    expect(screen.getByText('Marta Rios')).toBeInTheDocument();
    expect(screen.getByText('+543765252395')).toBeInTheDocument();
  });

  it('sin teléfono muestra solo el nombre, sin un hueco ni "null"', () => {
    const { container } = render(<ClienteConTelefono cliente={{ ...marta, telefono: null }} variante="fila" />);

    expect(screen.getByText('Marta Rios')).toBeInTheDocument();
    expect(container.textContent).toBe('Marta Rios');
  });

  it('un apellido vacío no deja un espacio de más', () => {
    const { container } = render(<ClienteConTelefono cliente={{ nombre: 'Ana', apellido: null, telefono: '' }} variante="fila" />);

    expect(container.textContent).toBe('Ana');
  });
});
