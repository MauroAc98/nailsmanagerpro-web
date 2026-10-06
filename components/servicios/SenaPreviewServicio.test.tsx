import { beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import SenaPreviewServicio from './SenaPreviewServicio';

// Vista previa bajo el precio del servicio: espeja lo que ve el cliente al
// reservar y lo que le llega al salón. Los números salen de lib/senaPreview.

function setUser(parcial: Partial<User> | null) {
  useAuthStore.setState({
    user: parcial === null ? null : ({
      sena_tipo: 'porcentaje', sena_porcentaje: 30, sena_monto: null,
      retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...parcial,
    } as User),
  });
}

// Harness con el campo de precio real: permite probar "Usar", "Deshacer" y
// la edición manual del precio.
function Harness({ inicial }: { inicial: string }) {
  const [precio, setPrecio] = useState(inicial);
  return (
    <>
      <input aria-label="precio" value={precio} onChange={e => setPrecio(e.target.value)} />
      <SenaPreviewServicio precio={precio} onUsarPrecio={setPrecio} />
    </>
  );
}

function setup(precio: string) {
  renderWithProviders(<Harness inicial={precio} />);
}

beforeEach(() => setUser({}));

describe('SenaPreviewServicio', () => {
  it('client card: just "Seña" and the exact amount, no fee wording', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    const card = screen.getByText('Así lo ve tu cliente al reservar').parentElement!;
    expect(within(card).getByText('Seña')).toBeInTheDocument();
    expect(within(card).getByText('$9.000')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(within(card).queryByText(/%|comisi|Mercado|gesti/i)).toBeNull();
  });

  it('professional card: deposit, Mercado Pago cost, net received and cost as % of the price', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    const card = screen.getByText('Lo que te llega a vos').parentElement!;
    expect(within(card).getByText('Tu cliente paga de seña')).toBeInTheDocument();
    expect(within(card).getByText('− Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(within(card).getByText('$685')).toBeInTheDocument();
    expect(within(card).getByText('Te llegan')).toBeInTheDocument();
    expect(within(card).getByText('$8.315')).toBeInTheDocument();
    expect(within(card).getByText('Es el 3,8% del precio.')).toBeInTheDocument();
    expect(screen.queryByText('Cobrás en el salón')).toBeNull();
  });

  it('follows a different commission instead of a hardcoded 7,6', () => {
    setUser({ comision_mp_vigente: 5.5 });
    setup('10000');
    expect(screen.getByText('− Mercado Pago (5,5%)')).toBeInTheDocument();
    expect(screen.queryByText(/7,6%/)).toBeNull();
  });

  it('hides the retention row when it is 0', () => {
    setup('10000');
    expect(screen.queryByText('− Retención de impuestos')).toBeNull();
  });

  it('shows the retention row with its amount when > 0', () => {
    setUser({ sena_porcentaje: 50, retencion_iibb_porcentaje: 4 });
    setup('18000');
    expect(screen.getByText('− Retención de impuestos')).toBeInTheDocument();
    expect(screen.getByText('$360')).toBeInTheDocument(); // round(9000 * 4 / 100)
  });

  it('fixed mode: exact amount and NO price suggestion', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('20000');
    expect(screen.getAllByText('$5.000')).toHaveLength(2); // cliente + profesional
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing without a valid seña configuration', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: null });
    setup('10400');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing when the salon has no deposit (percentage type without a percentage)', () => {
    setUser({ sena_tipo: 'porcentaje', sena_porcentaje: null, sena_monto: null });
    setup('10400');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
  });

  it('renders nothing without a user', () => {
    setUser(null);
    setup('10400');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
  });

  it('renders nothing for an empty or invalid price', () => {
    setup('');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('understands es-AR thousands separators in the price field', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18.000');
    expect(screen.getAllByText('$9.000')).toHaveLength(2);
  });

  it('keeps money on one line (nowrap) so amounts are never cut with an ellipsis', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    for (const t of ['$685', '$8.315']) expect(screen.getByText(t)).toHaveStyle({ whiteSpace: 'nowrap' });
  });
});

describe('SenaPreviewServicio — price suggestion', () => {
  beforeEach(() => setUser({ sena_porcentaje: 50 }));

  it('percentage mode offers a price that covers the cost and a round deposit', () => {
    setup('18000');
    expect(screen.getByText(
      'Con $19.600 tu cliente paga $9.800 de seña y a vos te llegan $9.054, cubriendo el costo de Mercado Pago.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar $19.600' })).toBeInTheDocument();
  });

  it('"Usar" sets the price and shows a confirmation with the previous price, no new suggestion', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $19.600' }));
    expect(screen.getByLabelText('precio')).toHaveValue('19600');
    expect(screen.getByText('Precio ajustado. Antes: $18.000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.queryByText(/cubriendo el costo/)).toBeNull();
    // las tarjetas siguen mostrando los números del nuevo precio
    expect(screen.getAllByText('$9.800')).toHaveLength(2);
  });

  it('"Deshacer" restores the previous price and offers the suggestion again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $19.600' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByLabelText('precio')).toHaveValue('18000');
    expect(screen.queryByText(/Precio ajustado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $19.600' })).toBeInTheDocument();
  });

  it('editing the price by hand leaves the confirmation and suggests again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $19.600' }));
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '25000' } });
    expect(screen.queryByText(/Precio ajustado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $27.200' })).toBeInTheDocument();
  });

  it('shows no suggestion for an invalid price', () => {
    setup('abc');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
