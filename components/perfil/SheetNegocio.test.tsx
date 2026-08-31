import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SheetNegocio } from './SheetNegocio';

// The seña opt-in surfaces bank-transfer data inside the WhatsApp
// confirmation. The sheet must gate its own save with the same business rule
// the backend guard enforces (monto > 0 + direccion + titular + alias|CBU)
// and strip control characters the server rejects.

type Props = Parameters<typeof SheetNegocio>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    senaMonto: '5000',
    setSenaMonto: vi.fn(),
    whatsappPideSena: false,
    setWhatsappPideSena: vi.fn(),
    senaTitular: '',
    setSenaTitular: vi.fn(),
    senaEntidad: '',
    setSenaEntidad: vi.fn(),
    senaAlias: '',
    setSenaAlias: vi.fn(),
    senaCbu: '',
    setSenaCbu: vi.fn(),
    confirmacionAutomatica: true,
    setConfirmacionAutomatica: vi.fn(),
    recordatorioAutomatico: false,
    setRecordatorioAutomatico: vi.fn(),
    horaRecordatorio: '20:00',
    setHoraRecordatorio: vi.fn(),
    nombreNegocio: 'Salon Ana',
    telefonoContacto: '+543765000000',
    direccionNegocio: 'Av. Siempreviva 742',
    erroresServidor: undefined,
    onGuardar: vi.fn(),
    guardando: false,
    error: null,
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<SheetNegocio {...props} />);
  return props;
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
const senaToggle = () => screen.getByRole('switch', { name: 'Pedir seña para confirmar turnos' });

describe('SheetNegocio — seña opt-in toggle', () => {
  it('hides the bank inputs while the toggle is OFF', () => {
    setup({ whatsappPideSena: false });
    expect(screen.queryByRole('textbox', { name: 'Titular de la cuenta' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Alias' })).toBeNull();
  });

  it('reveals titular, entidad, alias and CBU inputs when the toggle is ON', () => {
    setup({ whatsappPideSena: true });
    expect(screen.getByRole('textbox', { name: 'Titular de la cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Banco o billetera (opcional)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Alias' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'CBU/CVU (opcional)' })).toBeInTheDocument();
  });

  it('flips the toggle through the parent setter', () => {
    const props = setup({ whatsappPideSena: false });
    fireEvent.click(senaToggle());
    expect(props.setWhatsappPideSena).toHaveBeenCalledWith(true);
  });
});

describe('SheetNegocio — client validation when seña is ON', () => {
  const onCompleto = {
    whatsappPideSena: true,
    senaMonto: '5000',
    senaTitular: 'Ana Gomez',
    senaAlias: 'ana.gomez.mp',
    direccionNegocio: 'Av. Siempreviva 742',
  } satisfies Partial<Props>;

  it('saves when monto, direccion, titular and alias are present', () => {
    const props = setup(onCompleto);
    save();
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('allows an empty entidad and empty CBU as long as the alias is set', () => {
    const props = setup({ ...onCompleto, senaEntidad: '', senaCbu: '' });
    save();
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('accepts CBU instead of alias', () => {
    const props = setup({ ...onCompleto, senaAlias: '', senaCbu: '0000003100010000000001' });
    save();
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('blocks the save and shows an error when only the titular is filled', () => {
    const props = setup({ ...onCompleto, senaAlias: '', senaCbu: '' });
    save();
    expect(props.onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Cargá el alias o el CBU de la cuenta.')).toBeInTheDocument();
  });

  it('blocks the save when the monto is zero', () => {
    const props = setup({ ...onCompleto, senaMonto: '0' });
    save();
    expect(props.onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Ingresá un monto de seña mayor a cero.')).toBeInTheDocument();
  });

  it('blocks the save and points to the other sheet when the address is missing', () => {
    const props = setup({ ...onCompleto, direccionNegocio: '' });
    save();
    expect(props.onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Cargá tu dirección en Datos personales para poder pedir seña.')).toBeInTheDocument();
  });

  it('sanitizes a pasted value with a newline before submitting', () => {
    const props = setup({ ...onCompleto, senaTitular: 'Ana\nGomez  SA' });
    save();
    expect(props.setSenaTitular).toHaveBeenCalledWith('Ana Gomez SA');
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });

  it('surfaces a server-side field error passed from the parent', () => {
    setup({ whatsappPideSena: true, erroresServidor: { whatsapp_sena_titular: 'El titular ya está en uso.' } });
    expect(screen.getByText('El titular ya está en uso.')).toBeInTheDocument();
  });
});

describe('SheetNegocio — seña OFF still saves', () => {
  it('calls onGuardar without validation when the toggle is OFF', () => {
    const props = setup({ whatsappPideSena: false, senaMonto: '', senaTitular: '', senaAlias: '' });
    save();
    expect(props.onGuardar).toHaveBeenCalledTimes(1);
  });
});
