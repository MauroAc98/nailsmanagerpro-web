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
  it('two plain sentences: what the client leaves (and where it comes from) and what you receive', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.getByText('Seña de la reserva online')).toBeInTheDocument();
    expect(screen.getByText('$9.000')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByText('(el 50% de $18.000)')).toBeInTheDocument();
    expect(screen.getByText('$8.315')).toBeInTheDocument();
  });

  it('the commission, percentages and the cost note are hidden until "Ver detalle"', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    expect(screen.queryByText(/Mercado Pago \(/)).toBeNull();
    expect(screen.queryByText(/del precio\./)).toBeNull();
    expect(screen.queryByText(/cobra una comisión/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.getByText('Comisión de Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('− $685')).toBeInTheDocument();
    expect(screen.getByText('Te llegan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle' }));
    expect(screen.queryByText('El cliente paga')).toBeNull();
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

  it('fixed mode: says it is a fixed amount and NO price suggestion or button', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('20000', { precioInicial: '20000' });
    expect(screen.getByText('$5.000')).toBeInTheDocument();
    expect(screen.getByText('(monto fijo)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
  });

  it('understands es-AR thousands separators in the price field', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18.000');
    expect(screen.getByText('$9.000')).toBeInTheDocument();
  });

  it('keeps money on one line (nowrap) so amounts are never cut with an ellipsis', () => {
    setUser({ sena_porcentaje: 50 });
    setup('18000');
    for (const t of ['$9.000', '$8.315']) expect(screen.getByText(t)).toHaveStyle({ whiteSpace: 'nowrap' });
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
    expect(screen.getByText('Seña de 30% del precio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(onConfigurar).toHaveBeenCalledTimes(1);
  });

  it('shows the fixed amount when the seña is a fixed amount', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    setup('18000', { onConfigurar: vi.fn() });
    expect(screen.getByText('Seña fija de $5.000')).toBeInTheDocument();
  });
});

describe('SenaPreviewServicio — price suggestion', () => {
  beforeEach(() => setUser({ sena_porcentaje: 50 }));

  it('percentage mode, price edited: one question and one button with the amount that gets applied', () => {
    setup('18000');
    expect(screen.getByText(
      'Para que te lleguen los $9.000 completos, podés cobrar $20.000 (hoy $18.000): la seña sube a $10.000.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar $20.000' })).toBeInTheDocument();
  });

  it('a service just opened (price untouched) shows NO offer but a button to see the suggestion', () => {
    setup('18000', { precioInicial: '18000' });
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.getByText(/Mercado Pago cobra una comisión por cada pago online/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver precio sugerido' })).toBeInTheDocument();
  });

  it('tapping "Ver precio sugerido" reveals the offer without touching the price', () => {
    setup('18000', { precioInicial: '18000' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver precio sugerido' }));
    expect(screen.getByRole('button', { name: 'Usar $20.000' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Usar $22.000' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver precio sugerido' })).toBeNull();
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '18000' } });
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver precio sugerido' })).toBeInTheDocument();
  });

  it('accepting sets the price and shows a confirmation with the previous price, no new suggestion', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $20.000' }));
    expect(screen.getByLabelText('precio')).toHaveValue('20000');
    expect(screen.getByText('Precio ajustado. Antes: $18.000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usar/ })).toBeNull();
    expect(screen.queryByText(/podés cobrar/)).toBeNull();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
  });

  it('"Deshacer" restores the previous price and offers the suggestion again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $20.000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByLabelText('precio')).toHaveValue('18000');
    expect(screen.queryByText(/Precio ajustado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $20.000' })).toBeInTheDocument();
  });

  it('editing the price by hand leaves the confirmation and suggests again', () => {
    setup('18000');
    fireEvent.click(screen.getByRole('button', { name: 'Usar $20.000' }));
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '25000' } });
    expect(screen.queryByText(/Precio ajustado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar $28.000' })).toBeInTheDocument();
  });

  it('shows no suggestion for an invalid price', () => {
    setup('abc');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
