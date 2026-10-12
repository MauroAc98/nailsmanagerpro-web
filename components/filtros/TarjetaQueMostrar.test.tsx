import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TarjetaQueMostrar } from './TarjetaQueMostrar';

describe('TarjetaQueMostrar', () => {
  it('muestra el título opcional y las filas', () => {
    render(<TarjetaQueMostrar caption="Qué mostrar"><button>Fila A</button></TarjetaQueMostrar>);
    expect(screen.getByText('Qué mostrar')).toBeInTheDocument();
    expect(screen.getByText('Fila A')).toBeInTheDocument();
  });

  it('sin caption no dibuja el título', () => {
    const { container } = render(<TarjetaQueMostrar><button>Fila A</button></TarjetaQueMostrar>);
    expect(container.querySelector('p')).toBeNull();
  });

  it('separa las filas con una línea y no deja línea por hijos vacíos', () => {
    const { container } = render(
      <TarjetaQueMostrar>
        <button>Fila A</button>
        {false}
        <button>Fila B</button>
        {null}
      </TarjetaQueMostrar>,
    );
    const divisores = Array.from(container.querySelectorAll('div > div > div')).filter(d => d.getAttribute('data-divisor') !== null);
    expect(divisores).toHaveLength(1);
  });

  it('una sola fila no lleva línea', () => {
    const { container } = render(<TarjetaQueMostrar><button>Fila A</button></TarjetaQueMostrar>);
    expect(container.querySelector('[data-divisor]')).toBeNull();
  });
});
