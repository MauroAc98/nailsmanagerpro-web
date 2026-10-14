import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import SenaPreviewServicio from './SenaPreviewServicio';

// Tarjeta "Seña de la reserva online" del formulario de servicio: explica lo que
// deja el cliente, lo que se queda Mercado Pago y lo que le llega al salón. La seña ya cubre la
// comisión (backend: senaParaPrecio), así que no hay nada que ajustar en el precio. Los
// números salen de lib/senaPreview.

function setUser(parcial: Partial<User> | null) {
  useAuthStore.setState({
    user: parcial === null ? null : ({
      sena_tipo: 'porcentaje', sena_porcentaje: 30, sena_monto: null,
      retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...parcial,
    } as User),
  });
}

// Harness con el campo de precio real: permite probar que la tarjeta sigue al precio.
function Harness({ inicial, activa = true, onConfigurar }: { inicial: string; activa?: boolean; onConfigurar?: () => void }) {
  const [precio, setPrecio] = useState(inicial);
  return (
    <>
      <input aria-label="precio" value={precio} onChange={e => setPrecio(e.target.value)} />
      <SenaPreviewServicio precio={precio} activa={activa} onConfigurar={onConfigurar} />
    </>
  );
}

function setup(precio: string, opts: { activa?: boolean; onConfigurar?: () => void } = {}) {
  renderWithProviders(<Harness inicial={precio} {...opts} />);
}

beforeEach(() => setUser({}));

describe('SenaPreviewServicio', () => {
  it('two plain sentences: what the client leaves, what Mercado Pago keeps and what arrives', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000'); // 9.000 / 0,9239 = 9.742 -> 10.000; comisión 761; llegan 9.239
    expect(screen.getByText('Seña de la reserva online')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText('$761')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText('$9.239')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText(/Mercado Pago se queda/)).toBeInTheDocument();
  });

  it('there is nothing to adjust: no price suggestion, offer or button anywhere', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.queryByRole('button', { name: /Usar|sugerido/ })).toBeNull();
    expect(screen.queryByText(/subir el precio|precio sugerido|Es opcional/i)).toBeNull();
  });

  it('with a tax retention, the second sentence adds it to what is kept', () => {
    setUser({ sena_porcentaje: 50, retencion_iibb_porcentaje: 4 });
    setup('18000'); // seña 10.500: comisión 799 + retención 420 = 1.219; llegan 9.281
    expect(screen.getByText('$10.500')).toBeInTheDocument();
    expect(screen.getByText('$1.219')).toBeInTheDocument();
    expect(screen.getByText('$9.281')).toBeInTheDocument();
    expect(screen.getByText(/la retención de impuestos se quedan/)).toBeInTheDocument();
  });

  it('says the seña already gives her the whole percentage of the price', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.getByText('Con eso te llega completo el 50% del precio ($9.000).')).toBeInTheDocument();
  });

  it('does not claim that when the deposit is the whole price (nothing left to cover the cost with)', () => {
    setUser({ sena_porcentaje: 100 });
    setup('600');
    expect(screen.queryByText(/te llega completo/)).toBeNull();
  });

  it('the commission, percentages and the cost note are hidden until "Ver detalle"', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.queryByText(/Mercado Pago \(/)).toBeNull();
    expect(screen.queryByText('Precio del servicio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Precio del servicio')).toBeInTheDocument();
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.getByText('Comisión de Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('− $761')).toBeInTheDocument();
    expect(screen.getByText('De la seña te llegan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle' }));
    expect(screen.queryByText('El cliente paga')).toBeNull();
  });

  it('the detail shows every step from the percentage to what the client pays (22.000 at 30%)', () => {
    setUser({ sena_porcentaje: 30 });
    setup('22000'); // 6.600 -> cubre 7.144 (+544) -> redondeo a 500 -> 7.500 (+356); comisión 571; llegan 6.929
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Seña del 30%')).toBeInTheDocument();
    expect(screen.getByText('$6.600')).toBeInTheDocument();
    expect(screen.getByText('Para cubrir la comisión')).toBeInTheDocument();
    expect(screen.getByText('+ $544')).toBeInTheDocument();
    expect(screen.getByText('Redondeo a $500')).toBeInTheDocument();
    expect(screen.getByText('+ $356')).toBeInTheDocument();
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.getByText('− $571')).toBeInTheDocument();
    expect(screen.getAllByText('$6.929')).toHaveLength(2); // la frase de arriba y la última fila
    expect(screen.getByText('La seña se redondea para que al cliente le resulte fácil completar el pago en el local.')).toBeInTheDocument();
  });

  it('no rounding row when the cost already lands on a multiple of the step', () => {
    setUser({ sena_porcentaje: 30, comision_mp_vigente: 0 });
    setup('25000'); // sin costo que cubrir: 7.500 exactos
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText('Para cubrir la comisión')).toBeNull();
    expect(screen.queryByText(/Redondeo a/)).toBeNull();
    expect(screen.queryByText(/se redondea/)).toBeNull();
  });

  it('no percentage steps when the deposit is the whole price', () => {
    setUser({ sena_porcentaje: 100 });
    setup('600');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText('Para cubrir la comisión')).toBeNull();
    expect(screen.queryByText(/Redondeo a/)).toBeNull();
    expect(screen.queryByText(/Seña del/)).toBeNull();
  });

  it('a tiny price keeps a tiny deposit with a small step: 100 at 30% is 40, not the whole price', () => {
    setUser({ sena_porcentaje: 30 });
    setup('100'); // 30 -> cubre 33 -> paso 10 -> 40; comisión 3; llegan 37
    expect(screen.getByText('$40')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Redondeo a $10')).toBeInTheDocument();
  });

  it('follows a different commission instead of a hardcoded 7,6', () => {
    setUser({ comision_mp_vigente: 5.5 });
    setup('10000');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Comisión de Mercado Pago (5,5%)')).toBeInTheDocument();
    expect(screen.queryByText(/7,6%/)).toBeNull();
  });

  it('hides the retention row when it is 0', () => {
    setup('10000');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText('Retención de impuestos')).toBeNull();
  });

  it('shows the retention row with its amount when > 0', () => {
    setUser({ sena_porcentaje: 50, retencion_iibb_porcentaje: 4 });
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Retención de impuestos')).toBeInTheDocument();
    expect(screen.getByText('− $420')).toBeInTheDocument(); // round(10500 * 4 / 100)
  });

  it('fixed mode: the fixed amount, no percentage steps and no price in the detail', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('20000');
    expect(screen.getByText('$5.000')).toBeInTheDocument();
    expect(screen.queryByText(/te llega completo/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.queryByText('Precio del servicio')).toBeNull();
    expect(screen.queryByText('Para cubrir la comisión')).toBeNull();
  });

  it('understands es-AR thousands separators in the price field', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18.000');
    expect(screen.getByText('$10.000')).toBeInTheDocument();
  });

  it('the card follows the price field, including the open detail', () => {
    setup('22000');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('$22.000')).toBeInTheDocument();
    expect(screen.getAllByText('$7.500')).toHaveLength(2); // la frase de arriba y la fila del detalle
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '48000' } });
    expect(screen.getByText('$48.000')).toBeInTheDocument();
    expect(screen.queryByText('$22.000')).toBeNull();
    expect(screen.getAllByText('$16.000').length).toBeGreaterThan(0); // 14.400 -> 15.587 -> 16.000
  });

  it('no "total price" figure anywhere: catalog prices are "desde", the final one depends on the design', () => {
    setup('11300');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText(/precio total/i)).toBeNull();
    expect(screen.queryByText(/del servicio completo/i)).toBeNull();
  });
});

describe('SenaPreviewServicio — only with online booking active', () => {
  it('renders nothing when online booking is not active', () => {
    setup('18000', { activa: false });
    expect(screen.queryByText('Seña de la reserva online')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing without a user', () => {
    setUser(null);
    setup('10400');
    expect(screen.queryByText('Seña de la reserva online')).toBeNull();
  });
});

describe('SenaPreviewServicio — missing configuration or price', () => {
  it('without a valid seña: explains it and offers the shortcut instead of disappearing', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: null });
    const onConfigurar = vi.fn();
    setup('10400', { onConfigurar });
    expect(screen.getByText(/Todavía no configuraste la seña/)).toBeInTheDocument();
    expect(screen.queryByText(/Tus clientes dejan/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Configurar seña y pagos/ }));
    expect(onConfigurar).toHaveBeenCalledTimes(1);
  });

  it('percentage type without a percentage counts as not configured', () => {
    setUser({ sena_tipo: 'porcentaje', sena_porcentaje: null, sena_monto: null });
    setup('10400');
    expect(screen.getByText(/Todavía no configuraste la seña/)).toBeInTheDocument();
  });

  it('with an empty or invalid price: asks for the price', () => {
    setup('');
    expect(screen.getByText('Ingresá un precio para ver la seña y lo que te llega.')).toBeInTheDocument();
    expect(screen.queryByText(/Tus clientes dejan/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the shortcut button only exists when onConfigurar is given', () => {
    setup('18000');
    expect(screen.queryByRole('button', { name: 'Cambiar' })).toBeNull();
  });

  it('shows which seña is configured with a "Cambiar" shortcut (percentage)', () => {
    const onConfigurar = vi.fn();
    setup('18000', { onConfigurar });
    expect(screen.getByText('Seña de 30% del precio, más la comisión de Mercado Pago')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(onConfigurar).toHaveBeenCalledTimes(1);
  });

  it('shows the fixed amount when the seña is a fixed amount', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('18000', { onConfigurar: vi.fn() });
    expect(screen.getByText('Seña fija de $5.000')).toBeInTheDocument();
  });

  it('shows no suggestion for an invalid price', () => {
    setup('abc');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
