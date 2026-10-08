import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SheetSenaYPagos } from './SheetSenaYPagos';

// Seña y pagos: el salón elige cobrar la seña como porcentaje del precio o
// como monto fijo, y declara si Mercado Pago le retiene impuestos.

type Props = Parameters<typeof SheetSenaYPagos>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
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
  renderWithProviders(<SheetSenaYPagos {...props} />);
  return props;
}

const montoInput = () => screen.getByRole('textbox', { name: 'Monto fijo por turno' });

describe('SheetSenaYPagos — modo de la seña', () => {
  it('offers a third option "Sin seña" and selects it through the parent setter', () => {
    const props = setup({ senaTipo: 'fijo' });
    expect(screen.getByRole('button', { name: 'Sin seña' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Sin seña' }));
    expect(props.setSenaTipo).toHaveBeenCalledWith('ninguna');
  });

  it('"Sin seña" hides the chips and the amount input and shows a neutral line', () => {
    setup({ senaTipo: 'ninguna', senaMonto: '' });
    expect(screen.getByRole('button', { name: 'Sin seña' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '30%' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Monto fijo por turno' })).toBeNull();
    expect(screen.getByText('No se cobra seña al reservar.')).toBeInTheDocument();
  });

  it('"Sin seña" shows the server error on sena_monto under the selector', () => {
    setup({
      senaTipo: 'ninguna',
      erroresServidor: { sena_monto: 'No podés vaciar la seña: tenés Mercado Pago conectado.' },
    });
    expect(screen.getByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });

  it('offers Porcentaje | Monto fijo and marks the current one', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30' });
    expect(screen.getByRole('button', { name: 'Porcentaje' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Monto fijo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches mode through the parent setter', () => {
    const props = setup({ senaTipo: 'fijo' });
    fireEvent.click(screen.getByRole('button', { name: 'Porcentaje' }));
    expect(props.setSenaTipo).toHaveBeenCalledWith('porcentaje');
  });

  it('percentage mode shows the chips and hides the amount input', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30' });
    for (const n of ['20%', '30%', '50%', '100%']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '30%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '20%' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox', { name: 'Monto fijo por turno' })).toBeNull();
  });

  it('picks a chip through the parent setter', () => {
    const props = setup({ senaTipo: 'porcentaje', senaPorcentaje: '30' });
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(props.setSenaPorcentaje).toHaveBeenCalledWith('50');
  });

  it('renders one extra selected chip when the saved percentage is not a preset', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '25', porcentajeGuardado: 25 });
    expect(screen.getByRole('button', { name: '25%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^\d+%$/ })).toHaveLength(5);
  });

  it('adds no extra chip when the saved percentage is a preset', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30', porcentajeGuardado: 30 });
    expect(screen.getAllByRole('button', { name: /^\d+%$/ })).toHaveLength(4);
  });

  it('fixed mode shows the amount input and hides the chips', () => {
    setup({ senaTipo: 'fijo', senaMonto: '7500' });
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

  it('surfaces a server error on sena_monto in fixed mode', () => {
    setup({ erroresServidor: { sena_monto: 'No podés vaciar la seña: tenés Mercado Pago conectado.' } });
    expect(screen.getByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });

  it('surfaces a server error on sena_porcentaje in percentage mode', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30', erroresServidor: { sena_porcentaje: 'El porcentaje debe estar entre 1 y 100.' } });
    expect(screen.getByText('El porcentaje debe estar entre 1 y 100.')).toBeInTheDocument();
  });

  it('shows the local percentage error', () => {
    setup({ senaTipo: 'porcentaje', errorPorcentaje: 'Elegí un porcentaje entre 1 y 100.' });
    expect(screen.getByText('Elegí un porcentaje entre 1 y 100.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — retención de impuestos', () => {
  it('asks the question and defaults to "No me descuenta" with no input', () => {
    setup({ retiene: false });
    expect(screen.getByText('¿Mercado Pago te descuenta una retención de impuestos?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No me descuenta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('textbox', { name: 'Porcentaje de la retención de impuestos' })).toBeNull();
  });

  it('toggles through the parent setter', () => {
    const props = setup({ retiene: false });
    fireEvent.click(screen.getByRole('button', { name: 'Sí me descuenta' }));
    expect(props.setRetiene).toHaveBeenCalledWith(true);
  });

  it('shows the percentage input only with "Sí"', () => {
    const props = setup({ retiene: true, retencion: '4' });
    const input = screen.getByRole('textbox', { name: 'Porcentaje de la retención de impuestos' });
    expect(input).toHaveValue('4');
    fireEvent.change(input, { target: { value: '4,5' } });
    expect(props.setRetencion).toHaveBeenCalledWith('4,5');
  });

  it('explains what the withholding is, with the examples', () => {
    setup();
    expect(screen.getByText(/Retención Impuesto Ingresos Brutos Régimen SIRTAC/)).toBeInTheDocument();
  });

  it('shows the retention error', () => {
    setup({ retiene: true, errorRetencion: 'Ingresá un porcentaje válido, entre 0 y 50.' });
    expect(screen.getByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — cargo de Mercado Pago (porcentaje)', () => {
  const pct = { senaTipo: 'porcentaje', senaPorcentaje: '30', senaMonto: '' } as const;

  it('derives the displayed percent from comision_mp_vigente, one decimal es-AR', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText(/descuenta 7,6%/)).toBeInTheDocument();
  });

  it('says the cost is discounted from each deposit and can be covered from the price', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText(
      'Mercado Pago descuenta 7,6% de cada seña. Podés cubrirlo desde el precio al editar un servicio.',
    )).toBeInTheDocument();
  });

  it('follows a different commission instead of a hardcoded one', () => {
    setup({ ...pct, comisionVigente: 5.5 });
    expect(screen.getByText(/descuenta 5,5%/)).toBeInTheDocument();
    expect(screen.queryByText(/7,6%/)).toBeNull();
  });

  it('omits the note when the commission is unknown', () => {
    setup({ ...pct, comisionVigente: null });
    expect(screen.queryByText(/Mercado Pago descuenta/)).toBeNull();
  });

  it('omits the note when online booking is not active (the fee only applies to online payments)', () => {
    setup({ ...pct, comisionVigente: 7.61, reservaOnlineActiva: false });
    expect(screen.queryByText(/Mercado Pago descuenta/)).toBeNull();
    expect(screen.queryByText(/Podés cubrirlo desde el precio/)).toBeNull();
  });

  it('does not repeat the generic note in fixed mode (the breakdown already shows the fee)', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: 7.61 });
    expect(screen.queryByText(/Mercado Pago descuenta/)).toBeNull();
  });
});

describe('SheetSenaYPagos — acciones', () => {
  it('saves through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('points to Mensajes automáticos for the bank-transfer data', () => {
    setup();
    expect(screen.getByText(/se cargan en Mensajes automáticos/)).toBeInTheDocument();
  });

  it('no longer offers the per-salon commission input or plazo chips', () => {
    setup();
    expect(screen.queryByRole('textbox', { name: /Comisión de Mercado Pago/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /días/ })).toBeNull();
  });
});

describe('SheetSenaYPagos — cálculo en monto fijo', () => {
  it('shows what the client pays, the MP fee and the net for the typed amount', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: 7.61 });
    expect(screen.getByText('El cliente paga')).toBeInTheDocument();
    expect(screen.getByText('$5.000,00')).toBeInTheDocument();
    expect(screen.getByText('−$381,00')).toBeInTheDocument();
    expect(screen.getByText('$4.619,00')).toBeInTheDocument();
  });

  it('suggests even when the API sends the amount as text with decimals (decimal:2)', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000.00', comisionVigente: 7.61 });
    expect(screen.getByRole('button', { name: 'Usar $5.500,00' })).toBeInTheDocument();
  });

  it('suggests a higher seña rounded up to 100 and applies it through the parent setter', () => {
    const props = setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: 7.61 });
    expect(screen.getByText(/Para recibir \$5\.000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar $5.500,00' }));
    expect(props.setSenaMonto).toHaveBeenCalledWith('5500');
  });

  it('shows neither the breakdown nor the suggestion when online booking is not active', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: 7.61, reservaOnlineActiva: false });
    expect(screen.queryByText(/Para recibir/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
    expect(screen.queryByText('El cliente paga')).toBeNull();
    expect(screen.queryByText(/Mercado Pago \(/)).toBeNull();
  });

  it('includes the tax retention when the user declares one', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: 7.61, retiene: true, retencion: '2' });
    expect(screen.getByText('Retención de impuestos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar $5.600,00' })).toBeInTheDocument();
  });

  it('shows nothing when the amount is empty/invalid or the commission is unknown', () => {
    setup({ senaTipo: 'fijo', senaMonto: '', comisionVigente: 7.61 });
    expect(screen.queryByText('El cliente paga')).toBeNull();
  });

  it('shows nothing in percentage mode or without commission', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30', comisionVigente: 7.61 });
    expect(screen.queryByText('El cliente paga')).toBeNull();
  });

  it('without a known commission it shows no calculation', () => {
    setup({ senaTipo: 'fijo', senaMonto: '5000', comisionVigente: null });
    expect(screen.queryByText('El cliente paga')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
  });
});
