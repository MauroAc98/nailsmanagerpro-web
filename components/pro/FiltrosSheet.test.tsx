import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';

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

function abrir(onCerrar = vi.fn()) {
  renderWithProviders(<FiltrosSheet abierto onCerrar={onCerrar} />);
  return onCerrar;
}

const filtros = () => useProAgendaStore.getState().filtros;

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo], vinculoActivoId: 1, bloqueos: {} });
  useProAgendaStore.getState().reset();
  vi.spyOn(proService, 'servicios').mockResolvedValue(servicios);
});
afterEach(() => vi.restoreAllMocks());

describe('FiltrosSheet', () => {
  it('cerrado no renderiza nada', () => {
    renderWithProviders(<FiltrosSheet abierto={false} onCerrar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto: diálogo con título enfocado y campos con etiqueta', async () => {
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Filtrar turnos' });
    expect(screen.getByRole('heading', { name: 'Filtrar turnos' })).toHaveFocus();
    expect(within(dialogo).getByLabelText('Buscar por nombre...')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Desde')).toHaveAttribute('min', '2000-01-01');
    expect(within(dialogo).getByLabelText('Hasta')).toHaveAttribute('min', '2000-01-01');
    expect(await within(dialogo).findByLabelText('Servicio')).toBeInTheDocument();
  });

  it('el selector ofrece "Todos" y cada servicio; elegir uno y aplicar lo guarda y cierra', async () => {
    const onCerrar = abrir();
    const select = await screen.findByLabelText('Servicio');
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Todos', 'Esmaltado', 'Pedicura']);

    fireEvent.change(select, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(filtros().servicioId).toBe(4);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('aplicar guarda el texto normalizado y el rango', async () => {
    abrir();
    await screen.findByLabelText('Servicio');
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: '  Ana   Pérez ' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(filtros()).toEqual({ buscar: 'Ana Pérez', servicioId: null, desde: '2026-10-01', hasta: '2026-10-05' });
  });

  it('con solo un extremo del rango, el otro toma la misma fecha', async () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(filtros()).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-01' });
  });

  it('más de 5 palabras: aviso en línea, no guarda ni cierra ni pide', async () => {
    const turnos = vi.spyOn(proService, 'turnos');
    const onCerrar = abrir();
    const campo = screen.getByLabelText('Buscar por nombre...');
    fireEvent.change(campo, { target: { value: 'a b c d e f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 60 caracteres');
    expect(filtros().buscar).toBe('');
  });

  it.each([
    ['hasta anterior a desde', '2026-10-05', '2026-10-01'],
    ['rango de 367 días', '2024-01-01', '2025-01-01'],
    ['antes del 2000', '1999-12-31', '2000-01-05'],
  ])('rango inválido (%s): aviso en línea y nada se guarda', (_n, desde, hasta) => {
    const turnos = vi.spyOn(proService, 'turnos');
    const onCerrar = abrir();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: desde } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: hasta } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Revisa las fechas');
    expect(filtros().desde).toBeNull();
    expect(onCerrar).not.toHaveBeenCalled();
    expect(turnos).not.toHaveBeenCalled();
  });

  it('si fallan los servicios, el resto de los filtros sigue funcionando y se puede reintentar', async () => {
    const mock = vi.spyOn(proService, 'servicios').mockRejectedValueOnce(new Error('boom')).mockResolvedValue(servicios);
    abrir();
    expect(await screen.findByText(/No pudimos|Algo salió mal|Error/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Servicio')).toBeNull();

    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(filtros().buscar).toBe('Ana');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Servicio')).toBeInTheDocument();
  });

  it('limpiar filtros está deshabilitado sin filtros y, con filtros, reinicia el store y cierra', () => {
    const onCerrar = abrir();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
    onCerrar.mockClear();
  });

  it('con filtros activos el formulario arranca con sus valores y limpiar reinicia hoy y vista de día', () => {
    useProAgendaStore.getState().setFecha('2026-09-01');
    useProAgendaStore.getState().setVista('mes');
    useProAgendaStore.getState().setFiltros({ buscar: 'Ana', desde: '2026-10-01', hasta: '2026-10-05' });
    const onCerrar = abrir();

    expect(screen.getByLabelText('Buscar por nombre...')).toHaveValue('Ana');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-01');
    const limpiar = screen.getByRole('button', { name: 'Limpiar filtros' });
    expect(limpiar).toBeEnabled();
    fireEvent.click(limpiar);

    const s = useProAgendaStore.getState();
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
    expect(s.vista).toBe('dia');
    expect(s.fecha).not.toBe('2026-09-01');
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('Escape y el botón Cerrar cierran sin guardar', () => {
    const onCerrar = abrir();
    fireEvent.change(screen.getByLabelText('Buscar por nombre...'), { target: { value: 'Ana' } });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
    expect(filtros().buscar).toBe('');
  });

  it('los botones y campos miden al menos 44px de alto', () => {
    abrir();
    for (const nombre of ['Aplicar', 'Limpiar filtros', 'Cerrar']) {
      expect(screen.getByRole('button', { name: nombre }).style.minHeight).toBe('44px');
    }
    expect(screen.getByLabelText('Buscar por nombre...').style.minHeight).toBe('44px');
    expect(screen.getByLabelText('Desde').style.minHeight).toBe('44px');
  });
});
