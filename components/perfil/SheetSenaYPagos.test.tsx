import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SheetSenaYPagos } from './SheetSenaYPagos';

// Seña y pagos: pantalla nueva del rediseño de Perfil. El monto de la seña
// se mudó acá desde Mensajes automáticos (SheetNegocio) para vivir junto al
// resto de lo relacionado a cobrar — ver components/perfil/SheetNegocio.tsx.

type Props = Parameters<typeof SheetSenaYPagos>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    senaMonto: '5000',
    setSenaMonto: vi.fn(),
    error: null,
    retencion: '',
    setRetencion: vi.fn(),
    comision: '',
    setComision: vi.fn(),
    errorRetencion: null,
    errorComision: null,
    erroresServidor: undefined,
    onGuardar: vi.fn(),
    guardando: false,
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<SheetSenaYPagos {...props} />);
  return props;
}

describe('SheetSenaYPagos', () => {
  it('shows the current deposit amount in the input', () => {
    setup({ senaMonto: '7500' });
    expect(screen.getByRole('textbox', { name: 'Monto de la seña ($)' })).toHaveValue('7500');
  });

  it('edits the amount through the parent setter', () => {
    const props = setup({ senaMonto: '' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Monto de la seña ($)' }), { target: { value: '9000' } });
    expect(props.setSenaMonto).toHaveBeenCalledWith('9000');
  });

  it('saves through the parent handler', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('shows a local format error', () => {
    setup({ error: 'Ingresá un monto válido (o dejalo vacío para no pedir seña).' });
    expect(screen.getByText('Ingresá un monto válido (o dejalo vacío para no pedir seña).')).toBeInTheDocument();
  });

  it('surfaces the Mercado Pago guard error from the server', () => {
    setup({ erroresServidor: { sena_monto: 'No podés vaciar la seña: tenés Mercado Pago conectado.' } });
    expect(screen.getByText('No podés vaciar la seña: tenés Mercado Pago conectado.')).toBeInTheDocument();
  });

  it('shows the commission and retention fields empty by default (no suggested value)', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Comisión de Mercado Pago (%)' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Retención de Ingresos Brutos (%)' })).toHaveValue('');
  });

  it('edits the retention through the parent setter', () => {
    const props = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Retención de Ingresos Brutos (%)' }), { target: { value: '4' } });
    expect(props.setRetencion).toHaveBeenCalledWith('4');
  });

  it('fills the commission when a plazo chip is tapped', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '10 días · 4,39%' }));
    expect(props.setComision).toHaveBeenCalledWith('4,39');
  });

  it('offers the four plazo chips', () => {
    setup();
    for (const n of ['Al instante · 6,29%', '10 días · 4,39%', '18 días · 3,39%', '35 días · 1,49%']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
  });

  it('highlights the chip matching the input and none when it differs', () => {
    setup({ comision: '3,39' });
    expect(screen.getByRole('button', { name: '18 días · 3,39%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '10 días · 4,39%' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the input editable after a chip (a custom value highlights no chip)', () => {
    const props = setup({ comision: '4,5' });
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: 'Comisión de Mercado Pago (%)' }), { target: { value: '5' } });
    expect(props.setComision).toHaveBeenCalledWith('5');
  });

  it('points to Mensajes automáticos for the bank-transfer data', () => {
    setup();
    expect(screen.getByText(/se cargan en Mensajes automáticos/)).toBeInTheDocument();
  });
});
