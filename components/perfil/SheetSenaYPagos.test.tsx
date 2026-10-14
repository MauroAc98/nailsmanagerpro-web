import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { desgloseSena } from '@/lib/senaPreview';
import { formatMonto } from '@/lib/money';
import { SheetSenaYPagos } from './SheetSenaYPagos';

// Seña y pagos: el salón decide cuánta seña pide el cliente y ve cuánto le
// llega; la comisión y la retención de Mercado Pago viven en una vista aparte.

type Props = Parameters<typeof SheetSenaYPagos>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    senaTipo: 'fijo',
    setSenaTipo: vi.fn(),
    senaPorcentaje: '',
    setSenaPorcentaje: vi.fn(),
    porcentajeGuardado: null,
    senaMonto: '5000',
    setSenaMonto: vi.fn(),
    error: null,
    errorPorcentaje: null,
    retiene: false,
    setRetiene: vi.fn(),
    retencion: '',
    setRetencion: vi.fn(),
    errorRetencion: null,
    comisionVigente: 7.61,
    reservaOnlineActiva: true,
    erroresServidor: undefined,
    onGuardar: vi.fn(),
    guardando: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

function setup(overrides: Partial<Props> = {}) {
  const props = baseProps(overrides);
  renderWithProviders(<SheetSenaYPagos {...props} />);
  return props;
}

const dinero = (n: number) => `$${formatMonto(n)}`;
const montoInput = () => screen.getByRole('textbox', { name: 'El cliente paga' });
const abrirMp = () => fireEvent.click(screen.getByRole('button', { name: 'Editar ›' }));

describe('SheetSenaYPagos — vista principal', () => {
  it('has the title and no subtitle nor question heading', () => {
    setup();
    expect(screen.getByText('Seña y pagos')).toBeInTheDocument();
    expect(screen.queryByText(/El monto que se le pide al cliente/)).toBeNull();
    expect(screen.queryByText('¿Cómo cobrás la seña?')).toBeNull();
  });

  it('closes through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('orders the segmented options: Sin seña | % del precio | Monto fijo', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30' });
    const grupo = screen.getByRole('group', { name: 'Cómo se cobra la seña' });
    const nombres = Array.from(grupo.querySelectorAll('button')).map(b => b.textContent);
    expect(nombres).toEqual(['Sin seña', '% del precio', 'Monto fijo']);
    expect(screen.getByRole('button', { name: '% del precio' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches mode through the parent setter', () => {
    const props = setup({ senaTipo: 'fijo' });
    fireEvent.click(screen.getByRole('button', { name: 'Sin seña' }));
    expect(props.setSenaTipo).toHaveBeenCalledWith('ninguna');
    fireEvent.click(screen.getByRole('button', { name: '% del precio' }));
    expect(props.setSenaTipo).toHaveBeenCalledWith('porcentaje');
  });

  it('saves through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });
});

describe('SheetSenaYPagos — sin seña', () => {
  it('shows one neutral line and no chips, input or calculator', () => {
    setup({ senaTipo: 'ninguna', senaMonto: '' });
    expect(screen.getByText('Los turnos se confirman sin pedir seña.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '30%' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'El cliente paga' })).toBeNull();
    expect(screen.queryByText('Te llegan')).toBeNull();
  });

  it('shows the server error on sena_monto', () => {
    setup({
      senaTipo: 'ninguna',
      erroresServidor: { sena_monto: 'No podés vaciar la seña: tenés Mercado Pago conectado.' },
    });
    expect(screen.getByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — porcentaje', () => {
  const pct = { senaTipo: 'porcentaje', senaPorcentaje: '30', senaMonto: '' } as const;

  it('shows the chips and hides the amount input', () => {
    setup(pct);
    for (const n of ['20%', '30%', '50%', '100%']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '30%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '20%' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox', { name: 'El cliente paga' })).toBeNull();
  });

  it('picks a chip through the parent setter', () => {
    const props = setup(pct);
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(props.setSenaPorcentaje).toHaveBeenCalledWith('50');
  });

  it('renders one extra selected chip when the saved percentage is not a preset', () => {
    setup({ ...pct, senaPorcentaje: '25', porcentajeGuardado: 25 });
    expect(screen.getByRole('button', { name: '25%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^\d+%$/ })).toHaveLength(5);
  });

  it('adds no extra chip when the saved percentage is a preset', () => {
    setup({ ...pct, porcentajeGuardado: 30 });
    expect(screen.getAllByRole('button', { name: /^\d+%$/ })).toHaveLength(4);
  });

  it('with online booking shows an example in three figures: what the client leaves, what Mercado Pago keeps, what arrives', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    const d = desgloseSena(3000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.getByText('Ejemplo con un servicio de $10.000')).toBeInTheDocument();
    expect(screen.getByText('El cliente deja')).toBeInTheDocument();
    expect(screen.getByText(dinero(3000))).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago se queda')).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.cargo))).toBeInTheDocument(); // $228
    expect(screen.getByText('De la seña te llegan')).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
    expect(screen.queryByText(/Del precio de cada servicio/)).toBeNull();
  });

  it('the example lists the tax retention only when there is one', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.queryByText('Retención de impuestos')).toBeNull();
  });

  it('says first how it works: the client pays the deposit through Mercado Pago, which keeps a commission', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText('Cómo funciona')).toBeInTheDocument();
    expect(screen.getByText(/deja una seña y la paga por Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByText(/se queda con una comisión de cada seña/)).toBeInTheDocument();
  });

  it('the "how it works" explanation also shows for a fixed amount', () => {
    setup({ senaTipo: 'fijo', comisionVigente: 7.61 });
    expect(screen.getByText('Cómo funciona')).toBeInTheDocument();
  });

  it('no "how it works" without online booking (the WhatsApp deposit is a bank transfer)', () => {
    setup({ ...pct, reservaOnlineActiva: false });
    expect(screen.queryByText('Cómo funciona')).toBeNull();
  });

  it('no "how it works" when no deposit is asked', () => {
    setup({ senaTipo: 'ninguna' });
    expect(screen.queryByText('Cómo funciona')).toBeNull();
  });

  it('explains why the percentage is rounded, once and apart from the price suggestion', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText(
      'La seña se redondea hacia arriba, normalmente a múltiplos de $500: así al cliente le resulta fácil completar el pago en el local.',
    )).toBeInTheDocument();
  });

  it('the example amount is rounded up to a multiple of 500 like the real deposit (33% of $10.000 -> $3.500)', () => {
    setup({ ...pct, senaPorcentaje: '33', comisionVigente: 7.61 });
    const d = desgloseSena(3500, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.getByText(dinero(3500))).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
  });

  it('with online booking tells where the price suggestion shows up', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText(/Si querés cubrir esa comisión, abrí un servicio y te sugerimos un precio. Es opcional./)).toBeInTheDocument();
  });

  it('without online booking there is no hint (no commission to cover)', () => {
    setup({ ...pct, reservaOnlineActiva: false });
    expect(screen.queryByText(/te sugerimos un precio/)).toBeNull();
  });

  it('the example follows the chosen percentage and the declared retention', () => {
    setup({ ...pct, senaPorcentaje: '50', retiene: true, retencion: '2' });
    const d = desgloseSena(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 });
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
  });

  it('without online booking shows only a small line and no calculator', () => {
    setup({ ...pct, reservaOnlineActiva: false });
    expect(screen.getByText('Del precio de cada servicio, redondeada hacia arriba.')).toBeInTheDocument();
    expect(screen.queryByText('Te llegan')).toBeNull();
    expect(screen.queryByText(/Ejemplo con un servicio/)).toBeNull();
  });

  it('shows the server percentage error', () => {
    setup({ ...pct, erroresServidor: { sena_porcentaje: 'El porcentaje debe estar entre 1 y 100.' } });
    expect(screen.getByText('El porcentaje debe estar entre 1 y 100.')).toBeInTheDocument();
  });

  it('shows the local percentage error', () => {
    setup({ ...pct, errorPorcentaje: 'Elegí un porcentaje entre 1 y 100.' });
    expect(screen.getByText('Elegí un porcentaje entre 1 y 100.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — monto fijo', () => {
  it('shows the amount input and hides the chips', () => {
    setup({ senaMonto: '7500' });
    expect(montoInput()).toHaveValue('7500');
    expect(screen.queryByRole('button', { name: '30%' })).toBeNull();
  });

  it('edits the amount through the parent setter', () => {
    const props = setup({ senaMonto: '' });
    fireEvent.change(montoInput(), { target: { value: '9000' } });
    expect(props.setSenaMonto).toHaveBeenCalledWith('9000');
  });

  it('shows the local amount error', () => {
    setup({ error: 'Ingresá un monto mayor a 0.' });
    expect(screen.getByText('Ingresá un monto mayor a 0.')).toBeInTheDocument();
  });

  it('shows the server error on sena_monto', () => {
    setup({ erroresServidor: { sena_monto: 'No podés vaciar la seña: tenés Mercado Pago conectado.' } });
    expect(screen.getByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });

  it('shows the net amount big and keeps the breakdown collapsed', () => {
    setup({ senaMonto: '5000' });
    const d = desgloseSena(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.getByText('Te llegan')).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
    expect(screen.queryByText('Mercado Pago (7,6%)')).toBeNull();
    expect(screen.queryByText(/incluye el IVA/)).toBeNull();
  });

  it('"Ver detalle" expands the breakdown and "Ocultar detalle" collapses it', () => {
    setup({ senaMonto: '5000' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle ▾' }));
    expect(screen.getByText('Mercado Pago (7,6%)')).toBeInTheDocument();
    expect(screen.getByText('−$381,00')).toBeInTheDocument();
    expect(screen.queryByText('Retención de impuestos')).toBeNull();
    expect(screen.getByText(/incluye el IVA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle ▴' }));
    expect(screen.queryByText('Mercado Pago (7,6%)')).toBeNull();
  });

  it('the expanded detail includes the retention when the user declares one', () => {
    setup({ senaMonto: '5000', retiene: true, retencion: '2' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle ▾' }));
    expect(screen.getByText('Retención de impuestos')).toBeInTheDocument();
  });

  it('suggests a pill and applies it through the parent setter', () => {
    const props = setup({ senaMonto: '5000' });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir $5.500,00 para que te lleguen $5.000,00' }));
    expect(props.setSenaMonto).toHaveBeenCalledWith('5500');
  });

  it('suggests even when the API sends the amount as text with decimals', () => {
    setup({ senaMonto: '5000.00' });
    expect(screen.getByRole('button', { name: /^Pedir \$5\.500,00/ })).toBeInTheDocument();
  });

  it('after applying shows "Listo. Antes" and Deshacer restores the previous amount', () => {
    function Harness() {
      const [monto, setMonto] = useState('5000');
      return <SheetSenaYPagos {...baseProps({ senaMonto: monto, setSenaMonto: setMonto })} />;
    }
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Pedir/ }));
    expect(montoInput()).toHaveValue('5500');
    expect(screen.getByText(/Listo\. Antes: \$5\.000,00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pedir/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(montoInput()).toHaveValue('5000');
    expect(screen.queryByText(/Listo\./)).toBeNull();
  });

  it('shows nothing of the calculator without online booking', () => {
    setup({ reservaOnlineActiva: false });
    expect(montoInput()).toBeInTheDocument();
    expect(screen.queryByText('Te llegan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver detalle ▾' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pedir/ })).toBeNull();
  });

  it('shows no calculator when the amount is empty', () => {
    setup({ senaMonto: '' });
    expect(screen.queryByText('Te llegan')).toBeNull();
  });
});

describe('SheetSenaYPagos — fila de Mercado Pago', () => {
  it('shows the row with the commission when there is no retention', () => {
    setup({ retiene: false });
    expect(screen.getByText('Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText('Comisión 7,6%')).toBeInTheDocument();
  });

  it('adds the retention to the subtitle when declared', () => {
    setup({ retiene: true, retencion: '2' });
    expect(screen.getByText('Comisión 7,6% · Retención 2%')).toBeInTheDocument();
  });

  it('follows a different commission', () => {
    setup({ comisionVigente: 5.5 });
    expect(screen.getByText('Comisión 5,5%')).toBeInTheDocument();
  });

  it('is hidden without online booking', () => {
    setup({ reservaOnlineActiva: false });
    expect(screen.queryByRole('button', { name: 'Editar ›' })).toBeNull();
  });

  it('is hidden when the commission is unknown', () => {
    setup({ comisionVigente: null });
    expect(screen.queryByRole('button', { name: 'Editar ›' })).toBeNull();
  });
});

describe('SheetSenaYPagos — vista de Mercado Pago', () => {
  it('"Editar ›" opens it and the back chevron returns to the main view', () => {
    setup();
    abrirMp();
    expect(screen.getByText('Comisión')).toBeInTheDocument();
    expect(screen.getByText('7,6% (con IVA)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '% del precio' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('button', { name: '% del precio' })).toBeInTheDocument();
  });

  it('the retention toggle calls setRetiene', () => {
    const props = setup({ retiene: false });
    abrirMp();
    expect(screen.getByText('Si aparece en el detalle de tus cobros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(props.setRetiene).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('textbox', { name: 'Porcentaje' })).toBeNull();
  });

  it('shows the percentage input only when it withholds', () => {
    const props = setup({ retiene: true, retencion: '4' });
    abrirMp();
    const input = screen.getByRole('textbox', { name: 'Porcentaje' });
    expect(input).toHaveValue('4');
    fireEvent.change(input, { target: { value: '4,5' } });
    expect(props.setRetencion).toHaveBeenCalledWith('4,5');
  });

  it('the disclosure expands the short explanation', () => {
    setup();
    abrirMp();
    expect(screen.queryByText(/Retención Ingresos Brutos/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '¿Dónde la veo? ▾' }));
    expect(screen.getByText(/Retención Ingresos Brutos/)).toBeInTheDocument();
    expect(screen.queryByText(/SIRTAC/)).toBeNull();
  });

  it('saves from the Mercado Pago view too', () => {
    const props = setup();
    abrirMp();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('starts in this view when the retention has an error, so it is visible', () => {
    setup({ retiene: true, errorRetencion: 'Ingresá un porcentaje válido, entre 0 y 50.' });
    expect(screen.getByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Porcentaje' })).toBeInTheDocument();
  });

  it('starts in this view for a server error on the retention field', () => {
    setup({ retiene: true, erroresServidor: { retencion_iibb_porcentaje: 'Retención inválida.' } });
    expect(screen.getByText('Retención inválida.')).toBeInTheDocument();
  });

  it('shows a retention error that appears later on the main view too', () => {
    const props = baseProps({ retiene: true, retencion: '' });
    const { rerender } = renderWithProviders(<SheetSenaYPagos {...props} />);
    rerender(<SheetSenaYPagos {...props} errorRetencion="Ingresá un porcentaje válido, entre 0 y 50." />);
    expect(screen.getByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — Mensajes automáticos', () => {
  it('the link calls onIrAMensajes', () => {
    const onIrAMensajes = vi.fn();
    setup({ onIrAMensajes });
    expect(screen.getByText(/Datos para transferencia por WhatsApp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mensajes automáticos ›' }));
    expect(onIrAMensajes).toHaveBeenCalledTimes(1);
  });

  it('without the callback it is plain text, not a button', () => {
    setup();
    expect(screen.getByText(/Mensajes automáticos ›/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mensajes automáticos ›' })).toBeNull();
  });
});
