import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agenda',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { FiltrosSheet } from './FiltrosSheet';

const vinculo: ProVinculo = {
  id: 1,
  negocioNombre: 'Negocio 1',
  profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
  disponible: true,
  motivo: null,
};

const servicios = { servicios: [{ id: 3, nombre: 'Esmaltado' }, { id: 4, nombre: 'Pedicura' }], descartados: 0 };

type Props = React.ComponentProps<typeof FiltrosSheet>;

function hoja(props: Partial<Props> = {}, acciones = { onCerrar: vi.fn(), onBorrarFecha: vi.fn(), onAbrirCalendario: vi.fn(), onAbrirServicios: vi.fn() }) {
  return { acciones, elemento: <FiltrosSheet abierto fecha={null} servicioId={null} {...acciones} {...props} /> };
}

// La fecha y el servicio del borrador los maneja quien abre la hoja (las hojas de
// calendario y de servicio son hermanas): acá entran por props.
function abrir(props: Partial<Props> = {}) {
  const { acciones, elemento } = hoja(props);
  renderWithProviders(elemento);
  return acciones;
}

const filtros = () => useProAgendaStore.getState().filtros;
const verResultados = () => screen.getByRole('button', { name: 'Ver resultados' });

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo], vinculoActivoId: 1, bloqueos: {} });
  useProAgendaStore.getState().reset();
  vi.spyOn(proService, 'servicios').mockResolvedValue(servicios);
});
afterEach(() => vi.restoreAllMocks());

describe('FiltrosSheet', () => {
  it('cerrado no renderiza nada', () => {
    renderWithProviders(hoja({ abierto: false }).elemento);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto: diálogo con el título enfocado (16/600), búsqueda y fila de servicio', async () => {
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Filtrar turnos' });
    const titulo = screen.getByRole('heading', { name: 'Filtrar turnos' });
    expect(titulo).toHaveFocus();
    expect(titulo.style.fontSize).toBe('16px');
    expect(titulo.style.fontWeight).toBe('600');
    expect(within(dialogo).getByLabelText('Buscar por nombre...')).toBeInTheDocument();
    expect(await within(dialogo).findByRole('button', { name: 'Servicio: Todos' })).toBeInTheDocument();
  });

  it('ya no hay campos Desde/Hasta ni selector nativo: la fecha es un botón', async () => {
    abrir();
    await screen.findByRole('button', { name: 'Servicio: Todos' });
    expect(screen.queryByLabelText('Desde')).toBeNull();
    expect(screen.queryByLabelText('Hasta')).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });

  it('botón de fecha: placeholder, 45 de alto y radio 12; tocarlo abre el calendario', () => {
    const { onAbrirCalendario } = abrir();
    const boton = screen.getByRole('button', { name: 'Elegir fecha' });
    expect(boton.parentElement?.style.height).toBe('45px');
    expect(boton.parentElement?.style.borderRadius).toBe('12px');
    expect(screen.queryByRole('button', { name: 'Quitar fecha' })).toBeNull();
    fireEvent.click(boton);
    expect(onAbrirCalendario).toHaveBeenCalledTimes(1);
  });

  it('con fecha muestra la fecha corta y un botón para borrarla', () => {
    const { onBorrarFecha, onAbrirCalendario } = abrir({ fecha: '2026-10-14' });
    expect(screen.queryByRole('button', { name: 'Elegir fecha' })).toBeNull();
    expect(screen.getByRole('button', { name: /mié.*14.*oct/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar fecha' }));
    expect(onBorrarFecha).toHaveBeenCalledTimes(1);
    expect(onAbrirCalendario).not.toHaveBeenCalled();
  });

  it('la fila de servicio muestra "Todos" o el servicio elegido y abre la hoja de selección', async () => {
    const { onAbrirServicios } = abrir({ servicioId: 4 });
    const fila = await screen.findByRole('button', { name: 'Servicio: Pedicura' });
    expect(fila.style.minHeight).toBe('56px');
    fireEvent.click(fila);
    expect(onAbrirServicios).toHaveBeenCalledTimes(1);
  });

  it('Ver resultados guarda texto normalizado, servicio y fecha única (desde = hasta) y cierra', async () => {
    const { onCerrar } = abrir({ fecha: '2026-10-14', servicioId: 4 });
    await screen.findByRole('button', { name: 'Servicio: Pedicura' });
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: '  Ana   Pérez ' } });
    fireEvent.click(verResultados());

    expect(filtros()).toEqual({ buscar: 'Ana Pérez', servicioId: 4, desde: '2026-10-14', hasta: '2026-10-14' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('sin fecha ni servicio, desde y hasta quedan vacíos', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    fireEvent.click(verResultados());
    expect(filtros()).toEqual({ buscar: 'Ana', servicioId: null, desde: null, hasta: null });
  });

  it('Ver resultados está deshabilitado (color divisor) mientras no haya ningún filtro', () => {
    const { onCerrar } = abrir();
    expect(verResultados()).toBeDisabled();
    expect(verResultados().style.backgroundColor).toBe(agendaColors.divider);
    fireEvent.click(verResultados());
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('Ver resultados se habilita con texto, con fecha o con servicio', () => {
    const { unmount } = renderWithProviders(hoja().elemento);
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    expect(verResultados()).toBeEnabled();
    unmount();
    const conFecha = renderWithProviders(hoja({ fecha: '2026-10-14' }).elemento);
    expect(verResultados()).toBeEnabled();
    conFecha.unmount();
    renderWithProviders(hoja({ servicioId: 3 }).elemento);
    expect(verResultados()).toBeEnabled();
  });

  it('con filtros ya guardados se puede aplicar el borrador vacío (quita los filtros)', () => {
    useProAgendaStore.getState().setFiltros({ buscar: 'Ana' });
    abrir();
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: '' } });
    expect(verResultados()).toBeEnabled();
    fireEvent.click(verResultados());
    expect(filtros().buscar).toBe('');
  });

  it('más de 5 palabras: aviso en línea, no guarda ni cierra ni pide', () => {
    const turnos = vi.spyOn(proService, 'turnos');
    const { onCerrar } = abrir();
    const campo = screen.getByLabelText('Buscar por nombre...');
    fireEvent.change(campo, { target: { value: 'a b c d e f' } });
    fireEvent.click(verResultados());

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Escribe hasta 5 palabras.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo.getAttribute('aria-describedby')).toContain(alerta.id);
    expect(filtros().buscar).toBe('');
    expect(onCerrar).not.toHaveBeenCalled();
    expect(turnos).not.toHaveBeenCalled();
  });

  it('texto de más de 60 caracteres: aviso de largo', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'x'.repeat(61) } });
    fireEvent.click(verResultados());
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 60 caracteres');
    expect(filtros().buscar).toBe('');
  });

  it('si fallan los servicios, el resto de los filtros sigue funcionando y se puede reintentar', async () => {
    const mock = vi.spyOn(proService, 'servicios').mockRejectedValueOnce(new Error('boom')).mockResolvedValue(servicios);
    abrir();
    expect(await screen.findByText(/No pudimos|Algo salió mal|Error/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Servicio/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    fireEvent.click(verResultados());
    expect(filtros().buscar).toBe('Ana');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Servicio: Todos' })).toBeInTheDocument();
  });

  it('mientras cargan los servicios muestra el spinner', () => {
    abrir();
    expect(screen.getByRole('status', { name: 'Cargando servicios' })).toBeInTheDocument();
  });

  it('"Limpiar todo" solo aparece con filtros activos, en el encabezado, en color primario 13/600', () => {
    const { unmount } = renderWithProviders(hoja().elemento);
    expect(screen.queryByRole('button', { name: 'Limpiar todo' })).toBeNull();
    unmount();
    renderWithProviders(hoja({ fecha: '2026-10-14' }).elemento);
    const limpiar = screen.getByRole('button', { name: 'Limpiar todo' });
    expect(limpiar.style.fontSize).toBe('13px');
    expect(limpiar.style.fontWeight).toBe('600');
    expect(limpiar.style.color).toBe(agendaColors.primaryDeep);
    const campo = screen.getByLabelText('Buscar por nombre...');
    expect(limpiar.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Limpiar todo reinicia el store (y vuelve a hoy) y cierra', () => {
    useProAgendaStore.getState().setFecha('2026-09-01');
    useProAgendaStore.getState().setFiltros({ buscar: 'Ana', desde: '2026-10-01', hasta: '2026-10-01' });
    const { onCerrar } = abrir({ fecha: '2026-10-01' });

    expect(screen.getByLabelText('Buscar por nombre...')).toHaveValue('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar todo' }));

    const s = useProAgendaStore.getState();
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
    expect(s.fecha).not.toBe('2026-09-01');
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('Escape y el botón Cerrar cierran sin guardar', () => {
    const { onCerrar } = abrir();
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
    expect(filtros().buscar).toBe('');
  });

  it('secciones Cliente y Fecha, búsqueda con ícono y fila de servicio en tarjeta', async () => {
    abrir();
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Cliente')).toBeInTheDocument();
    expect(within(dialogo).getByText('Fecha')).toBeInTheDocument();
    expect(within(dialogo).getByPlaceholderText('Buscar por nombre...')).toBeInTheDocument();
    const fila = await within(dialogo).findByRole('button', { name: 'Servicio: Todos' });
    expect(fila.parentElement?.style.borderRadius).toBe('14px');
    expect(within(dialogo).queryByText(/profesional/i)).toBeNull();
  });

  it('el botón de borrar vacía la búsqueda y solo aparece con texto', () => {
    abrir();
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
    const campo = screen.getByLabelText('Buscar por nombre...');
    fireEvent.change(campo, { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(campo).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
  });

  it('los botones y campos táctiles miden al menos 44px de alto', () => {
    abrir({ fecha: '2026-10-14' });
    for (const nombre of ['Cerrar', 'Limpiar todo', 'Quitar fecha']) {
      expect(screen.getByRole('button', { name: nombre }).style.minHeight).toBe('44px');
    }
    expect(screen.getByLabelText('Buscar por nombre...').style.minHeight).toBe('44px');
    expect(verResultados().style.minHeight).toBe('44px');
  });
});
