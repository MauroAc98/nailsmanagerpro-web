import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
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

function setup(precio: string, onUsarPrecio = vi.fn(), nombre = 'Softgel') {
  renderWithProviders(<SenaPreviewServicio nombre={nombre} precio={precio} onUsarPrecio={onUsarPrecio} />);
  return onUsarPrecio;
}

beforeEach(() => setUser({}));

describe('SenaPreviewServicio', () => {
  it('shows what the client sees when booking', () => {
    setup('10400');
    expect(screen.getByText('Así lo ve tu cliente al reservar')).toBeInTheDocument();
    expect(screen.getByText('Softgel')).toBeInTheDocument();
    expect(screen.getByText('$10.400')).toBeInTheDocument();
    expect(screen.getByText('Seña (30%)')).toBeInTheDocument();
    expect(screen.getAllByText('$3.120')).toHaveLength(2); // seña + seña cobrada
    expect(screen.getByText('Resta pagar en el salón')).toBeInTheDocument();
    expect(screen.getByText('$7.280')).toBeInTheDocument();
  });

  it('shows what the salon receives, with the commission derived from comision_mp_vigente', () => {
    setup('10400');
    expect(screen.getByText('Lo que te llega a vos')).toBeInTheDocument();
    expect(screen.getByText('Seña cobrada')).toBeInTheDocument();
    expect(screen.getByText('− Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('$237')).toBeInTheDocument(); // round(3120 * 7.61 / 100)
    expect(screen.getByText('Te llegan')).toBeInTheDocument();
    expect(screen.getByText('$2.883')).toBeInTheDocument(); // 3120 - 237
    expect(screen.getByText(/Es el 2,3% del precio/)).toBeInTheDocument();
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
    setUser({ retencion_iibb_porcentaje: 4 });
    setup('10000');
    expect(screen.getByText('− Retención de impuestos')).toBeInTheDocument();
    expect(screen.getByText('$120')).toBeInTheDocument(); // round(3000 * 4 / 100)
  });

  it('suggests a clean price and applies it with the button', () => {
    const onUsar = setup('10400');
    expect(screen.getByText('Con $11.000 la seña sería $3.300, un número redondo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar $11.000' }));
    expect(onUsar).toHaveBeenCalledWith('11000');
  });

  it('confirms when the seña is already round', () => {
    setup('11000');
    expect(screen.getByText('Con este precio, la seña queda en un número redondo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
  });

  it('fixed mode shows the cards but no suggestion and no percentage', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('10400');
    expect(screen.getByText('Seña')).toBeInTheDocument();
    expect(screen.getAllByText('$5.000')).toHaveLength(2); // seña + seña cobrada
    expect(screen.queryByText(/Seña \(/)).toBeNull();
    expect(screen.queryByText(/un número redondo/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
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
    setup('1.500,50');
    expect(screen.getByText('Seña (30%)')).toBeInTheDocument();
  });

  it('keeps money on one line (nowrap) so amounts are never cut with an ellipsis', () => {
    setup('10400');
    for (const el of screen.getAllByText('$3.120')) expect(el).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText('$2.883')).toHaveStyle({ whiteSpace: 'nowrap' });
  });
});
