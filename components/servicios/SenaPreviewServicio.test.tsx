import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import SenaPreviewServicio from './SenaPreviewServicio';

// Tarjeta "Seña de la reserva online" del formulario de servicio: explica lo que
// paga el cliente, la comisión de Mercado Pago y lo que le llega al salón. Los
// números salen de lib/senaPreview.

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
function Harness({ inicial, activa = true, onConfigurar, precioInicial }: {
  inicial: string; activa?: boolean; onConfigurar?: () => void; precioInicial?: string;
}) {
  const [precio, setPrecio] = useState(inicial);
  return (
    <>
      <input aria-label="precio" value={precio} onChange={e => setPrecio(e.target.value)} />
      <SenaPreviewServicio
        precio={precio} onUsarPrecio={setPrecio} activa={activa} onConfigurar={onConfigurar}
        precioInicial={precioInicial}
      />
    </>
  );
}

// `precioInicial`: el precio con el que se abrió el formulario (servicio ya
// guardado). Sin él, cualquier precio cargado cuenta como "tocado".
function setup(precio: string, opts: { activa?: boolean; onConfigurar?: () => void; precioInicial?: string } = {}) {
  renderWithProviders(<Harness inicial={precio} {...opts} />);
}

beforeEach(() => setUser({}));

describe('SenaPreviewServicio', () => {
  it('two plain sentences: what the client leaves and what Mercado Pago keeps', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.getByText('Seña de la reserva online')).toBeInTheDocument();
    expect(screen.getByText('$9.000')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText('$685')).toHaveStyle({ whiteSpace: 'nowrap' }); // round(9000 * 7.61 / 100)
    expect(screen.getByText(/Mercado Pago se queda/)).toBeInTheDocument();
    // La cuenta (cuánto llega, de dónde sale la seña) vive en "Ver detalle".
    expect(screen.queryByText(/te llegan/)).toBeNull();
    expect(screen.queryByText(/el 50%/)).toBeNull();
  });

  it('with a tax retention, the second sentence adds it to what is kept', () => {
    setUser({ sena_porcentaje: 50, retencion_iibb_porcentaje: 4 });
    setup('18000'); // 685 + 360
    expect(screen.getByText('$1.045')).toBeInTheDocument();
    expect(screen.getByText(/la retención de impuestos se quedan/)).toBeInTheDocument();
  });

  it('the commission, percentages and the cost note are hidden until "Ver detalle"', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.queryByText(/Mercado Pago \(/)).toBeNull();
    expect(screen.queryByText(/del precio\./)).toBeNull();
    expect(screen.queryByText('Precio del servicio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Precio del servicio')).toBeInTheDocument();
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.getByText('Comisión de Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('− $685')).toBeInTheDocument();
    expect(screen.getByText('De la seña te llegan')).toBeInTheDocument();
    expect(screen.getByText('$8.315')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle' }));
    expect(screen.queryByText('El cliente paga')).toBeNull();
  });

  it('the rounding is explained once, in the detail, only when it happened (22.000 at 30% -> 7.000)', () => {
    setUser({ sena_porcentaje: 30 });
    setup('22000'); // 30% = 6.600 -> 7.000
    expect(screen.queryByText(/redond/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Seña del 30%')).toBeInTheDocument();
    expect(screen.getByText('$6.600')).toBeInTheDocument();
    expect(screen.getByText('Redondeo a $500')).toBeInTheDocument();
    expect(screen.getByText('+ $400')).toBeInTheDocument();
    expect(screen.getByText('La seña se redondea para que al cliente le resulte fácil completar el pago en el local.')).toBeInTheDocument();
  });

  it('no rounding rows or note when the percentage already lands on a multiple of 500', () => {
    setUser({ sena_porcentaje: 30 });
    setup('25000'); // 30% = 7.500
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText('Redondeo a $500')).toBeNull();
    expect(screen.queryByText(/se redondea/)).toBeNull();
  });

  it('no rounding rows when the deposit is the whole price (tiny price or 100%)', () => {
    setUser({ sena_porcentaje: 30 });
    setup('30'); // 30% = 9 -> 500 -> capped at the price
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText('Redondeo a $500')).toBeNull();
    expect(screen.queryByText(/el 30%/)).toBeNull();
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
    expect(screen.getByText('− $360')).toBeInTheDocument(); // round(9000 * 4 / 100)
  });

  it('fixed mode: no price in the detail and NO price suggestion or button', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('20000', { precioInicial: '20000' });
    expect(screen.getByText('$5.000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.queryByText('Precio del servicio')).toBeNull();
  });

  it('understands es-AR thousands separators in the price field', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18.000');
    expect(screen.getByText('$9.000')).toBeInTheDocument();
  });

  it('keeps money on one line (nowrap) so amounts are never cut with an ellipsis', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    for (const t of ['$9.000', '$685']) expect(screen.getByText(t)).toHaveStyle({ whiteSpace: 'nowrap' });
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
    expect(screen.getByText('Seña de 30% del precio, redondeada hacia arriba')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(onConfigurar).toHaveBeenCalledTimes(1);
  });

  it('shows the fixed amount when the seña is a fixed amount', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('18000', { onConfigurar: vi.fn() });
    expect(screen.getByText('Seña fija de $5.000')).toBeInTheDocument();
  });
});

// El detalle sigue al precio: aunque la seña redondeada sea la misma, el precio del servicio cambia.
describe('SenaPreviewServicio — the detail follows the price', () => {
  beforeEach(() => setUser({ sena_porcentaje: 30 }));

  it('after "Usar" the open detail shows the new price even when the deposit amounts are identical', () => {
    setup('11300'); // 30% = 3.390 -> 3.500, comisión 266
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('$11.300')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar $11.600' }));
    expect(screen.getByLabelText('precio')).toHaveValue('11600');
    expect(screen.getByText('$11.600')).toBeInTheDocument(); // 30% = 3.480 -> 3.500: misma seña
    expect(screen.queryByText('$11.300')).toBeNull();
    expect(screen.getByText('− $266')).toBeInTheDocument();
  });

  it('no "total price" figure anywhere: catalog prices are "desde", the final one depends on the design', () => {
    setup('11300');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.queryByText(/precio total/i)).toBeNull();
    expect(screen.queryByText(/del servicio completo/i)).toBeNull();
  });
});

describe('SenaPreviewServicio — price suggestion', () => {
  beforeEach(() => setUser({ sena_porcentaje: 50 }));

  it('percentage mode, price edited: one question and one button with the amount that gets applied', () => {
    setup('18000');
    // 50% de 18.800 = 9.400 -> 9.500: la seña cambia, así que la oferta lo dice.
    expect(screen.getByText(
      'Si querés cubrir esa comisión, podés subir el precio a $18.800 (hoy $18.000); la seña pasa a $9.500. Es opcional.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar $18.800' })).toBeInTheDocument();
  });

  it('when the deposit stays the same with the new price, the offer does not mention it', () => {
    setUser({ sena_porcentaje: 30 });
    setup('11300'); // 3.390 -> 3.500 y 3.480 -> 3.500
    expect(screen.getByText(
      'Si querés cubrir esa comisión, podés subir el precio a $11.600 (hoy $11.300). Es opcional.',
    )).toBeInTheDocument();
    expect(screen.queryByText(/la seña pasa/)).toBeNull();
  });

  it('a service just opened (price untouched) shows NO offer but a button to see the suggestion', () => {
    setup('18000', { precioInicial: '18000' });
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.getByText(/Podés ajustar el precio para cubrir esa comisión/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver precio sugerido' })).toBeInTheDocument();
  });

  it('tapping "Ver precio sugerido" reveals the offer without touching the price', () => {
    setup('18000', { precioInicial: '18000' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver precio sugerido' }));
    expect(screen.getByRole('button', { name: 'Usar $18.800' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
  });

  it('the button does not show when the price was touched (the offer takes over)', () => {
    setup('18000');
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
  });

  it('compares the opening price as a number (a saved "18000.00" equals "18000")', () => {
    setup('18000', { precioInicial: '18000.00' });
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver precio sugerido' })).toBeInTheDocument();
  });

  it('no commission to cover (0%): no offer and no button', () => {
    setUser({ sena_porcentaje: 50, comision_mp_vigente: 0 });
    setup('18000', { precioInicial: '18000' });
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
  });

  it('editing the price after opening swaps the button for the offer, and going back brings the button back', () => {
    setup('18000', { precioInicial: '18000' });
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '20000' } });
    expect(screen.getByRole('button', { name: 'Usar $21.000' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '18000' } });
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver precio sugerido' })).toBeInTheDocument();
  });

  it('accepting sets the price and shows a confirmation with the previous price, no new suggestion', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $18.800' }));
    expect(screen.getByLabelText('precio')).toHaveValue('18800');
    expect(screen.getByText('Listo: con $18.800 esa comisión queda cubierta. Antes: $18.000.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.queryByText(/podés cobrar/)).toBeNull();
    expect(screen.getByText('$9.500')).toBeInTheDocument();
  });

  it('"Deshacer" restores the previous price and offers the suggestion again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $18.800' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByLabelText('precio')).toHaveValue('18000');
    expect(screen.queryByText(/Listo: con/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $18.800' })).toBeInTheDocument();
  });

  it('editing the price by hand leaves the confirmation and suggests again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $18.800' }));
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '25000' } });
    expect(screen.queryByText(/Listo: con/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $26.000' })).toBeInTheDocument();
  });

  it('shows no suggestion for an invalid price', () => {
    setup('abc');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
