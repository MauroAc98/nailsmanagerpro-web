import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { desgloseSena } from '@/lib/senaPreview';
import { formatMonto } from '@/lib/money';
import { SheetSenaYPagos } from './SheetSenaYPagos';

// Seña y pagos: la dueña elige cómo cobra la seña entre tres opciones que se
// explican solas y ve un resultado de una línea (cuánto dejan los clientes y
// cuánto le llega). Impuestos y transferencia por WhatsApp viven en "Más opciones".

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
const montoInput = () => screen.getByRole('textbox', { name: 'Monto de la seña' });
const opcion = (nombre: string) => screen.getByRole('radio', { name: nombre });
const abrirMasOpciones = () => fireEvent.click(screen.getByRole('button', { name: /^Más opciones/ }));

describe('SheetSenaYPagos — vista principal', () => {
  it('has the title and asks one plain question, with no "how it works" paragraph', () => {
    setup();
    expect(screen.getByText('Seña y pagos')).toBeInTheDocument();
    expect(screen.getByText('¿Cómo querés cobrar la seña?')).toBeInTheDocument();
    expect(screen.queryByText('Cómo funciona')).toBeNull();
    expect(screen.queryByText(/deja una seña y la paga por Mercado Pago/)).toBeNull();
  });

  it('closes through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('offers three options in order: Sin seña | Un porcentaje del precio | Un monto fijo', () => {
    setup({ senaTipo: 'porcentaje', senaPorcentaje: '30' });
    const grupo = screen.getByRole('radiogroup', { name: '¿Cómo querés cobrar la seña?' });
    const radios = within(grupo).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName('Sin seña');
    expect(radios[1]).toHaveAccessibleName('Un porcentaje del precio');
    expect(radios[2]).toHaveAccessibleName('Un monto fijo');
    expect(opcion('Sin seña')).toHaveAttribute('aria-checked', 'false');
    expect(opcion('Un porcentaje del precio')).toHaveAttribute('aria-checked', 'true');
    expect(opcion('Un monto fijo')).toHaveAttribute('aria-checked', 'false');
  });

  it('each option says in one line what it means, including who pays the commission', () => {
    setup();
    expect(screen.getByText('Los turnos se confirman sin pedir nada.')).toBeInTheDocument();
    expect(screen.getByText('Se calcula según cada servicio. La comisión de Mercado Pago ya está incluida.')).toBeInTheDocument();
    expect(screen.getByText('El mismo monto en todos los turnos. La comisión sale de ese monto.')).toBeInTheDocument();
  });

  it('without online booking the options do not mention Mercado Pago (the WhatsApp deposit is a transfer)', () => {
    setup({ reservaOnlineActiva: false });
    expect(screen.getByText('Se calcula según cada servicio.')).toBeInTheDocument();
    expect(screen.getByText('El mismo monto en todos los turnos.')).toBeInTheDocument();
    expect(screen.queryByText(/Mercado Pago/)).toBeNull();
  });

  it('switches mode through the parent setter', () => {
    const props = setup({ senaTipo: 'fijo' });
    fireEvent.click(opcion('Sin seña'));
    expect(props.setSenaTipo).toHaveBeenCalledWith('ninguna');
    fireEvent.click(opcion('Un porcentaje del precio'));
    expect(props.setSenaTipo).toHaveBeenCalledWith('porcentaje');
  });

  it('saves through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });
});

describe('SheetSenaYPagos — sin seña', () => {
  it('shows no chips, input, result nor "Más opciones"', () => {
    setup({ senaTipo: 'ninguna', senaMonto: '' });
    expect(opcion('Sin seña')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: '30%' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Monto de la seña' })).toBeNull();
    expect(screen.queryByText('A vos te llegan')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Más opciones/ })).toBeNull();
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
    expect(screen.queryByRole('textbox', { name: 'Monto de la seña' })).toBeNull();
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

  it('with online booking the result is two lines: what the clients leave and what arrives', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    // 30% de $10.000 = $3.000; la seña que cubre la comisión es $3.500 (3.000 / 0,9239 = 3.247 -> 3.500)
    const d = desgloseSena(3500, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.getByText('Ejemplo con un servicio de $10.000')).toBeInTheDocument();
    expect(screen.getByText('Tus clientes dejan')).toBeInTheDocument();
    expect(screen.getByText(dinero(3500))).toBeInTheDocument();
    expect(screen.getByText('A vos te llegan')).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument(); // $3.234
    expect(screen.queryByText(/Del precio de cada servicio/)).toBeNull();
  });

  it('keeps what Mercado Pago keeps behind "Ver detalle"', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    const d = desgloseSena(3500, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.queryByText('Mercado Pago se queda')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle ▾' }));
    expect(screen.getByText('Mercado Pago se queda')).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.cargo))).toBeInTheDocument(); // $266
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle ▴' }));
    expect(screen.queryByText('Mercado Pago se queda')).toBeNull();
  });

  it('the example says that what arrives covers the whole percentage', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText('Así te llega completo el 30% del servicio ($3.000).')).toBeInTheDocument();
  });

  it('lists the tax retention in the detail only when there is one', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle ▾' }));
    expect(screen.queryByText('Retención de impuestos')).toBeNull();
  });

  it('explains why the percentage is rounded, once and apart from any price suggestion', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.getByText(
      'La seña se redondea hacia arriba, normalmente a múltiplos de $500: así al cliente le resulta fácil completar el pago en el local.',
    )).toBeInTheDocument();
  });

  it('the example amount covers the cost and is rounded up like the real deposit (33% of $10.000 -> $4.000)', () => {
    setup({ ...pct, senaPorcentaje: '33', comisionVigente: 7.61 });
    const d = desgloseSena(4000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 }); // 3.300 / 0,9239 = 3.572
    expect(screen.getByText(dinero(4000))).toBeInTheDocument();
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
  });

  it('there is no price suggestion text: the deposit already covers the commission', () => {
    setup({ ...pct, comisionVigente: 7.61 });
    expect(screen.queryByText(/te sugerimos|precio sugerido|subir el precio|ajustar el precio/i)).toBeNull();
  });

  it('the example follows the chosen percentage and the declared retention', () => {
    setup({ ...pct, senaPorcentaje: '50', retiene: true, retencion: '2' });
    // 50% de $10.000 = $5.000; con 7,61 + 2 de retención: 5.000 / 0,9039 = 5.532 -> 6.000
    const d = desgloseSena(6000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 });
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle ▾' }));
    expect(screen.getByText('Retención de impuestos')).toBeInTheDocument();
  });

  it('without online booking shows only a small line and no result', () => {
    setup({ ...pct, reservaOnlineActiva: false });
    expect(screen.getByText('Del precio de cada servicio, redondeada hacia arriba.')).toBeInTheDocument();
    expect(screen.queryByText('A vos te llegan')).toBeNull();
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

  it('shows one figure for what arrives, next to what the clients leave, and keeps the breakdown collapsed', () => {
    setup({ senaMonto: '5000' });
    const d = desgloseSena(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 0 });
    expect(screen.getByText('Tus clientes dejan')).toBeInTheDocument();
    expect(screen.getByText(dinero(5000))).toBeInTheDocument();
    expect(screen.getAllByText('A vos te llegan')).toHaveLength(1);
    expect(screen.getByText(dinero(d!.llega))).toBeInTheDocument(); // $4.619
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

  it('gives the tip as advice and applies it through the parent setter', () => {
    const props = setup({ senaMonto: '5000' });
    expect(screen.getByText('¿Querés que te lleguen $5.000,00 completos? Pedí $5.500,00.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir $5.500,00' }));
    expect(props.setSenaMonto).toHaveBeenCalledWith('5500');
  });

  it('suggests even when the API sends the amount as text with decimals', () => {
    setup({ senaMonto: '5000.00' });
    expect(screen.getByRole('button', { name: 'Pedir $5.500,00' })).toBeInTheDocument();
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
    expect(screen.queryByText('A vos te llegan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver detalle ▾' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pedir/ })).toBeNull();
  });

  it('shows no calculator when the amount is empty', () => {
    setup({ senaMonto: '' });
    expect(screen.queryByText('A vos te llegan')).toBeNull();
  });
});

describe('SheetSenaYPagos — fila "Más opciones"', () => {
  it('shows it with a deposit, naming taxes and the WhatsApp transfer', () => {
    setup();
    expect(screen.getByRole('button', { name: /^Más opciones/ })).toHaveTextContent('Impuestos y transferencia por WhatsApp');
  });

  it('without online booking it only mentions the WhatsApp transfer', () => {
    setup({ reservaOnlineActiva: false });
    const fila = screen.getByRole('button', { name: /^Más opciones/ });
    expect(fila).toHaveTextContent('Transferencia por WhatsApp');
    expect(fila).not.toHaveTextContent('Impuestos');
  });

  it('does not put the commission or the retention on the main view anymore', () => {
    setup({ retiene: true, retencion: '2' });
    expect(screen.queryByText('Comisión 7,6% · Retención 2%')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar ›' })).toBeNull();
  });

  it('shows a retention error that appears later on the main view too', () => {
    const props = baseProps({ retiene: true, retencion: '' });
    const { rerender } = renderWithProviders(<SheetSenaYPagos {...props} />);
    rerender(<SheetSenaYPagos {...props} errorRetencion="Ingresá un porcentaje válido, entre 0 y 50." />);
    expect(screen.getByText('Ingresá un porcentaje válido, entre 0 y 50.')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — vista "Más opciones"', () => {
  it('opens from the row and the back chevron returns to the main view', () => {
    setup();
    abrirMasOpciones();
    expect(screen.getByText('Comisión')).toBeInTheDocument();
    expect(screen.getByText('7,6% (con IVA)')).toBeInTheDocument();
    expect(screen.getByText('La fija Mercado Pago y sale de cada seña pagada online.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Un monto fijo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('radio', { name: 'Un monto fijo' })).toBeInTheDocument();
  });

  it('the retention toggle is worded as everyday language and calls setRetiene', () => {
    const props = setup({ retiene: false });
    abrirMasOpciones();
    expect(screen.getByText('Me descuentan impuestos')).toBeInTheDocument();
    expect(screen.getByText('Activalo si en el detalle de un cobro ves una línea de retención.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(props.setRetiene).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('textbox', { name: 'Porcentaje' })).toBeNull();
  });

  it('shows the percentage input only when it withholds', () => {
    const props = setup({ retiene: true, retencion: '4' });
    abrirMasOpciones();
    const input = screen.getByRole('textbox', { name: 'Porcentaje' });
    expect(input).toHaveValue('4');
    fireEvent.change(input, { target: { value: '4,5' } });
    expect(props.setRetencion).toHaveBeenCalledWith('4,5');
  });

  it('the disclosure expands the short explanation', () => {
    setup();
    abrirMasOpciones();
    expect(screen.queryByText(/Retención Ingresos Brutos/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '¿Dónde la veo? ▾' }));
    expect(screen.getByText(/Retención Ingresos Brutos/)).toBeInTheDocument();
    expect(screen.queryByText(/SIRTAC/)).toBeNull();
  });

  it('saves from this view too', () => {
    const props = setup();
    abrirMasOpciones();
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

  it('without online booking there is no Mercado Pago section, only the transfer one', () => {
    setup({ reservaOnlineActiva: false });
    abrirMasOpciones();
    expect(screen.queryByText('Me descuentan impuestos')).toBeNull();
    expect(screen.queryByText('Comisión')).toBeNull();
    expect(screen.getByText('Seña por transferencia (WhatsApp)')).toBeInTheDocument();
  });
});

describe('SheetSenaYPagos — seña por transferencia (WhatsApp)', () => {
  it('explains it and its link calls onIrAMensajes', () => {
    const onIrAMensajes = vi.fn();
    setup({ onIrAMensajes });
    abrirMasOpciones();
    expect(screen.getByText('Seña por transferencia (WhatsApp)')).toBeInTheDocument();
    expect(screen.getByText('Si pedís la seña por WhatsApp, tu cliente te transfiere. En ese caso tiene que ser un monto fijo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurar los datos para transferir ›' }));
    expect(onIrAMensajes).toHaveBeenCalledTimes(1);
  });

  it('without the callback it is plain text, not a button', () => {
    setup();
    abrirMasOpciones();
    expect(screen.getByText('Configurar los datos para transferir ›')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurar los datos para transferir ›' })).toBeNull();
  });
});
