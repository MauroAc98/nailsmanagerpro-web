import { afterEach, describe, expect, it } from 'vitest';
import { act, renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';
import { PrecioServiciosSheetHost } from './PrecioServiciosSheetHost';
import { pedirPreciosServicios, usePrecioServiciosStore } from '@/store/usePrecioServiciosStore';

const servicios = [
  { servicio_id: 1, nombre: 'Esmaltado semipermanente', precioReferencia: 18000 },
  { servicio_id: 2, nombre: 'Nail art', precioReferencia: 4500 },
];

const contexto = { cliente: 'Marta Ríos', fechaHora: '2026-09-16 12:30:00' };

function abrir(modo: 'finalizar' | 'cargar' = 'finalizar') {
  let promesa!: ReturnType<typeof pedirPreciosServicios>;
  act(() => {
    promesa = pedirPreciosServicios(servicios, { ...contexto, modo });
  });
  return promesa;
}

async function esperarArmado(nombreBoton: RegExp) {
  const boton = screen.getByRole('button', { name: nombreBoton });
  await waitFor(() => expect(boton).toBeEnabled());
  return boton;
}

afterEach(() => {
  usePrecioServiciosStore.setState({ visible: false, servicios: [], contexto: null, resolve: null });
});

describe('PrecioServiciosSheetHost', () => {
  it('muestra el cliente, el precio de lista de cada servicio y el total en el botón', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    abrir();

    expect(screen.getByText(/Marta Ríos/)).toBeInTheDocument();
    expect(screen.getByText(/Precio de lista \$18\.000/)).toBeInTheDocument();
    await esperarArmado(/Finalizar · \$22\.500/);
  });

  it('en modo cargar usa el vocabulario de "cargar precio"', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    abrir('cargar');

    await esperarArmado(/Guardar · \$22\.500/);
    expect(screen.getByRole('heading', { name: 'Cargar precio' })).toBeInTheDocument();
  });

  it('marca como ajustado un precio distinto al de lista y actualiza el total', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    abrir();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '19500' } });

    expect(screen.getByText(/Ajustado \+\$1\.500/i)).toBeInTheDocument();
    await esperarArmado(/Finalizar · \$24\.000/);
  });

  it('confirma con los precios cargados', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    const promesa = abrir();

    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '5000' } });
    fireEvent.click(await esperarArmado(/Finalizar · \$23\.000/));

    await expect(promesa).resolves.toEqual([
      { servicio_id: 1, precio: 18000 },
      { servicio_id: 2, precio: 5000 },
    ]);
  });

  it('"Sin cobro" registra precio 0 en todos los servicios', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    const promesa = abrir();

    fireEvent.click(screen.getByRole('button', { name: /No cobrar este turno/i }));
    fireEvent.click(await esperarArmado(/Finalizar sin cobro/));

    await expect(promesa).resolves.toEqual([
      { servicio_id: 1, precio: 0 },
      { servicio_id: 2, precio: 0 },
    ]);
  });

  it('Cancelar resuelve null', async () => {
    renderWithProviders(<PrecioServiciosSheetHost />);
    const promesa = abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await expect(promesa).resolves.toBeNull();
  });
});
