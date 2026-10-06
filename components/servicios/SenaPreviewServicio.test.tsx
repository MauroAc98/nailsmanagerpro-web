import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
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

function setup(precio: string) {
  renderWithProviders(<SenaPreviewServicio precio={precio} />);
}

beforeEach(() => setUser({}));

describe('SenaPreviewServicio', () => {
  it('client card: just "Seña" and the charged amount', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    const card = screen.getByText('Así lo ve tu cliente al reservar').parentElement!;
    expect(within(card).getByText('Seña')).toBeInTheDocument();
    expect(within(card).getByText('$9.800')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(within(card).queryByText(/%|comisi|Mercado|gesti/i)).toBeNull();
    expect(screen.queryByText(/Seña \(/)).toBeNull();
  });

  it('professional card: charged, Mercado Pago cost, net received and what is collected in the salon', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.getByText('Lo que te llega a vos')).toBeInTheDocument();
    expect(screen.getByText('Tu cliente paga de seña')).toBeInTheDocument();
    expect(screen.getByText('− Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('$746')).toBeInTheDocument();
    expect(screen.getByText('Te llegan')).toBeInTheDocument();
    expect(screen.getByText('$9.054')).toBeInTheDocument();
    expect(screen.getByText('Cobrás en el salón')).toBeInTheDocument();
    expect(screen.getByText('$9.000')).toBeInTheDocument();
    expect(screen.getByText('Se le suma a la seña para que te llegue completa.')).toBeInTheDocument();
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
    expect(screen.getByText('$408')).toBeInTheDocument(); // round(10200 * 4 / 100)
  });

  it('has no price suggestion banner or button anymore', () => {
    setup('10400');
    expect(screen.queryByText(/número redondo/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('fixed mode works too', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('20000');
    expect(screen.getAllByText('$5.500')).toHaveLength(2); // cliente + profesional
    expect(screen.getByText('$15.000')).toBeInTheDocument();
  });

  it('renders nothing without a valid seña configuration', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: null });
    setup('10400');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
  });

  it('renders nothing when the salon has no deposit (percentage type without a percentage)', () => {
    setUser({ sena_tipo: 'porcentaje', sena_porcentaje: null, sena_monto: null });
    setup('10400');
    expect(screen.queryByText('Así lo ve tu cliente al reservar')).toBeNull();
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 0 });
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
  });

  it('understands es-AR thousands separators in the price field', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18.000');
    expect(screen.getAllByText('$9.800')).toHaveLength(2);
  });

  it('keeps money on one line (nowrap) so amounts are never cut with an ellipsis', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    for (const t of ['$746', '$9.054', '$9.000']) expect(screen.getByText(t)).toHaveStyle({ whiteSpace: 'nowrap' });
  });
});
