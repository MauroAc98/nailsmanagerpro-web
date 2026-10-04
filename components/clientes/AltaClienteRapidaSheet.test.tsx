import { useRef } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { clienteService } from '@/services/clienteService';
import { useClientesStore } from '@/store/useClienteStore';
import { ConfirmSheetHost } from '@/components/ConfirmSheetHost';
import { AltaClienteRapidaSheet, type AltaClienteRapidaHandle } from './AltaClienteRapidaSheet';

vi.mock('@/services/clienteService', async () => {
  const actual = await vi.importActual<typeof import('@/services/clienteService')>('@/services/clienteService');
  return { ...actual, clienteService: { ...actual.clienteService, create: vi.fn() } };
});

// El BottomSheet real anima con getBoundingClientRect; en jsdom devuelve 0,
// que alcanza para que los campos existan en el DOM (el sheet no usa
// display:none, solo transform) — no hace falta mockearlo para esto.
function Harness({ onCreated }: { onCreated: (c: unknown) => void }) {
  const ref = useRef<AltaClienteRapidaHandle>(null);
  return (
    <>
      <button onClick={() => ref.current?.open()}>abrir</button>
      <AltaClienteRapidaSheet ref={ref} onCreated={onCreated as never} />
      <ConfirmSheetHost />
    </>
  );
}

describe('AltaClienteRapidaSheet', () => {
  beforeEach(() => {
    useClientesStore.setState({ clientes: [] });
    vi.mocked(clienteService.create).mockReset();
  });

  it('valida nombre, apellido y telefono antes de guardar', async () => {
    renderWithProviders(<Harness onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.click(screen.getByText('Agregar y seleccionar'));

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El apellido es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El teléfono es obligatorio')).toBeInTheDocument();
    expect(clienteService.create).not.toHaveBeenCalled();
  });

  it('crea el cliente y llama a onCreated con el cliente devuelto por el servicio', async () => {
    const nuevo = { id: 99, nombre: 'Carla', apellido: 'Gomez', telefono: '+5491122334455', activo: true };
    vi.mocked(clienteService.create).mockResolvedValue(nuevo);
    const onCreated = vi.fn();

    renderWithProviders(<Harness onCreated={onCreated} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Carla'), { target: { value: 'Carla' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gomez'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByPlaceholderText('Número sin código de país'), { target: { value: '1122334455' } });
    fireEvent.click(screen.getByText('Agregar y seleccionar'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(nuevo));
    expect(clienteService.create).toHaveBeenCalledWith({
      nombre: 'Carla', apellido: 'Gomez', telefono: '+541122334455',
    });
  });

  it('open() limpia los campos y errores de una apertura anterior', async () => {
    renderWithProviders(<Harness onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Carla'), { target: { value: 'Restos' } });
    fireEvent.click(screen.getByText('Agregar y seleccionar')); // dispara errores (falta apellido/telefono)
    expect(await screen.findByText('El apellido es obligatorio')).toBeInTheDocument();

    fireEvent.click(screen.getByText('abrir')); // reabrir
    expect(screen.getByPlaceholderText('Ej: Carla')).toHaveValue('');
    expect(screen.queryByText('El apellido es obligatorio')).toBeNull();
  });

  it('tipear espacios/guion en el teléfono no los guarda: solo dígitos, como pegarlo (bug real 2026-09-30)', async () => {
    const nuevo = { id: 100, nombre: 'Mónica', apellido: 'Palamarchuk', telefono: '+5493764240951', activo: true };
    vi.mocked(clienteService.create).mockResolvedValue(nuevo);

    renderWithProviders(<Harness onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Carla'), { target: { value: 'Mónica' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gomez'), { target: { value: 'Palamarchuk' } });
    // Tipeado, no pegado: el bug real guardaba esto tal cual, con el espacio
    // y el guion, rompiendo el envío de WhatsApp (la API pide solo dígitos).
    fireEvent.change(screen.getByPlaceholderText('Número sin código de país'), { target: { value: '376 424-0951' } });
    fireEvent.click(screen.getByText('Agregar y seleccionar'));

    await waitFor(() => expect(clienteService.create).toHaveBeenCalled());
    expect(clienteService.create).toHaveBeenCalledWith({
      nombre: 'Mónica', apellido: 'Palamarchuk', telefono: '+543764240951',
    });
  });

  it('tipear el número completo con código de país lo separa del selector, igual que al pegar', async () => {
    const nuevo = { id: 101, nombre: 'Rocío', apellido: 'Diaz', telefono: '+5511987654321', activo: true };
    vi.mocked(clienteService.create).mockResolvedValue(nuevo);

    renderWithProviders(<Harness onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Carla'), { target: { value: 'Rocío' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gomez'), { target: { value: 'Diaz' } });
    // Tipeado a mano con el "+55" adentro, sin tocar el selector de país
    // (que sigue en +54 por defecto): no debe quedar duplicado.
    fireEvent.change(screen.getByPlaceholderText('Número sin código de país'), { target: { value: '+5511987654321' } });
    fireEvent.click(screen.getByText('Agregar y seleccionar'));

    await waitFor(() => expect(clienteService.create).toHaveBeenCalled());
    expect(clienteService.create).toHaveBeenCalledWith({
      nombre: 'Rocío', apellido: 'Diaz', telefono: '+5511987654321',
    });
  });

  it('muestra el mensaje de error del servidor si crearCliente falla', async () => {
    vi.mocked(clienteService.create).mockRejectedValue({ response: { data: { message: 'Ya existe un cliente con ese teléfono' } } });
    renderWithProviders(<Harness onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('abrir'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Carla'), { target: { value: 'Carla' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gomez'), { target: { value: 'Gomez' } });
    fireEvent.change(screen.getByPlaceholderText('Número sin código de país'), { target: { value: '1122334455' } });
    fireEvent.click(screen.getByText('Agregar y seleccionar'));

    expect(await screen.findByText('Ya existe un cliente con ese teléfono')).toBeInTheDocument();
  });
});
