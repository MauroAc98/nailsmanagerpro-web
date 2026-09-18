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
    latitudNegocio: -27.4692,
    longitudNegocio: -58.8306,
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
const confirmacionToggle = () => screen.getByRole('switch', { name: 'Confirmación automática' });
const recordatorioToggle = () => screen.getByRole('switch', { name: 'Recordatorio automático' });

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

describe('SheetNegocio — message preview', () => {
  const openPreview = () => fireEvent.click(screen.getByRole('button', { name: 'Ver ejemplo de mensaje' }));

  const previewText = (match: RegExp) => screen.getByText(match).closest('p')?.textContent ?? '';

  it('shows the system-tone confirmation body, not the old warm one', () => {
    setup({ whatsappPideSena: false });
    openPreview();
    const text = previewText(/quedó confirmado/);
    expect(text).toContain('Desde este número solo se envían avisos');
    expect(text).not.toContain('¡Te esperamos!');
    expect(text).not.toContain('no hace falta responder');
  });

  it('shows the reserva_turno_sena body with formatted amount and account line when seña is on', () => {
    setup({
      whatsappPideSena: true,
      senaMonto: '5000',
      senaTitular: 'Ana Pérez',
      senaAlias: 'ana.mp',
      senaCbu: '2850001040094993682358',
    });
    openPreview();
    const text = previewText(/quedó reservado/);
    expect(text).toContain('una seña de $5.000,00');
    expect(text).toContain('Ana Pérez · Alias: ana.mp · CBU: 2850 0010 4009 4993 6823 58');
    expect(text).toContain('enviar el comprobante de la seña');
  });

  it('renders the reminder body on the recordatorio tab', () => {
    setup();
    openPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Recordatorio' }));
    expect(previewText(/te recordamos tu turno de mañana/))
      .toContain('Desde este número solo se envían avisos');
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
    expect(screen.getByText('Cargá tu dirección en Datos del negocio para poder pedir seña.')).toBeInTheDocument();
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

// Missing location (decision #691): blocks all three automation toggles the
// same way `faltaDireccion` already blocks the two automatic-messaging
// toggles, but with a deliberate asymmetry for the seña toggle — see the
// dedicated describe block below.
describe('SheetNegocio — missing location gate (automation toggles)', () => {
  it('disables confirmacionAutomatica when off and location is missing', () => {
    setup({ confirmacionAutomatica: false, latitudNegocio: null, longitudNegocio: null });
    expect(confirmacionToggle()).toHaveAttribute('aria-disabled', 'true');
  });

  it('leaves an already-ON confirmacionAutomatica toggle enabled despite missing location', () => {
    const props = setup({ confirmacionAutomatica: true, latitudNegocio: null, longitudNegocio: null });
    expect(confirmacionToggle()).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirmacionToggle());
    expect(props.setConfirmacionAutomatica).toHaveBeenCalledWith(false);
  });

  it('disables recordatorioAutomatico when off and location is missing', () => {
    setup({ recordatorioAutomatico: false, latitudNegocio: null, longitudNegocio: null });
    expect(recordatorioToggle()).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not disable the toggles when location is saved', () => {
    setup({ confirmacionAutomatica: false, recordatorioAutomatico: false, latitudNegocio: -27.4692, longitudNegocio: -58.8306 });
    expect(confirmacionToggle()).not.toHaveAttribute('aria-disabled', 'true');
    expect(recordatorioToggle()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the missing-location warning when location is missing', () => {
    setup({ latitudNegocio: null, longitudNegocio: null });
    expect(screen.getByText('Cargá tu ubicación en Datos del negocio para poder activar los envíos automáticos — la plantilla de WhatsApp la incluye.')).toBeInTheDocument();
  });

  it('does not render the missing-location warning when location is saved', () => {
    setup({ latitudNegocio: -27.4692, longitudNegocio: -58.8306 });
    expect(screen.queryByText('Cargá tu ubicación en Datos del negocio para poder activar los envíos automáticos — la plantilla de WhatsApp la incluye.')).toBeNull();
  });
});

// Decision #691 confirms all three toggles are blocked alike by missing
// location — but the seña toggle is deliberately NOT gated by faltaDireccion
// (unlike the two automation toggles above). Do not add faltaDireccion here.
describe('SheetNegocio — missing location gate (seña toggle, decision #691)', () => {
  it('disables the seña toggle when off and location is missing, even with an address on file', () => {
    setup({ whatsappPideSena: false, direccionNegocio: 'Av. Siempreviva 742', latitudNegocio: null, longitudNegocio: null });
    expect(senaToggle()).toHaveAttribute('aria-disabled', 'true');
  });

  it('does NOT disable the seña toggle when only the address is missing (location present)', () => {
    setup({ whatsappPideSena: false, direccionNegocio: '', latitudNegocio: -27.4692, longitudNegocio: -58.8306 });
    expect(senaToggle()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('leaves an already-ON seña toggle enabled despite missing location', () => {
    const props = setup({ whatsappPideSena: true, latitudNegocio: null, longitudNegocio: null });
    expect(senaToggle()).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(senaToggle());
    expect(props.setWhatsappPideSena).toHaveBeenCalledWith(false);
  });

  it('renders a missing-location warning near the deposit section', () => {
    setup({ latitudNegocio: null, longitudNegocio: null });
    expect(screen.getByText('Cargá tu ubicación en Datos del negocio para poder pedir seña.')).toBeInTheDocument();
  });
});

describe('SheetNegocio — preview map-header mock', () => {
  const openPreview = () => fireEvent.click(screen.getByRole('button', { name: 'Ver ejemplo de mensaje' }));

  it('shows the missing-location placeholder when location is missing', () => {
    setup({ latitudNegocio: null, longitudNegocio: null });
    openPreview();
    expect(screen.getByText('(marcá tu ubicación en Datos del negocio)')).toBeInTheDocument();
  });

  it('shows the business address instead of the placeholder when location is saved', () => {
    setup({ latitudNegocio: -27.4692, longitudNegocio: -58.8306, direccionNegocio: 'Av. Siempreviva 742' });
    openPreview();
    expect(screen.queryByText('(marcá tu ubicación en Datos del negocio)')).toBeNull();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
  });
});
