import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/services/adminService', () => ({
  adminService: { obtenerUsoResumen: vi.fn() },
}));

import UsoPage from './page';
import { adminService } from '@/services/adminService';

const obtener = vi.mocked(adminService.obtenerUsoResumen);
const ahoraS = () => Math.floor(Date.now() / 1000);
const haceDias = (n: number) => ahoraS() - n * 86400 - 60;

const negocio = (user_id: number, nombre: string, ultimo_turno_epoch: number | null) => ({
  user_id, nombre, ultimo_turno_epoch, turnos: 0, confirmaciones: 0, recordatorios: 0, fallos: 0,
});

const respuesta = (negocios: ReturnType<typeof negocio>[]) => ({ desde: '', hasta: '', negocios });

beforeEach(() => {
  obtener.mockReset();
  obtener.mockResolvedValue(respuesta([
    negocio(1, 'Manicuría Rocío', null),
    negocio(2, 'Casa Perla', haceDias(34)),
    negocio(3, 'Estudio Lila', haceDias(3)),
    negocio(4, 'Salón Aurora', ahoraS()),
  ]));
});

describe('UsoPage', () => {
  it('muestra una tarjeta por negocio con enlace al detalle y el subtítulo del último turno', async () => {
    render(<UsoPage />);
    await screen.findByText('Casa Perla');
    expect(screen.getByText('4 negocios · días desde su último turno, los más antiguos primero')).toBeTruthy();
    expect(screen.getByText('Nunca agendó un turno')).toBeTruthy();
    expect(screen.getByText('Casa Perla').closest('a')?.getAttribute('href')).toBe('/uso/2');
    expect(screen.getAllByText(/^Último turno: /).length).toBe(3);
  });

  it('muestra "—" si nunca agendó, "Hoy" si fue hoy y los días con su unidad', async () => {
    render(<UsoPage />);
    await screen.findByText('Casa Perla');
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('Activos deja solo los de hasta 14 días; Inactivos incluye a quien nunca agendó', async () => {
    render(<UsoPage />);
    await screen.findByText('Casa Perla');

    fireEvent.click(screen.getByRole('button', { name: 'Activos' }));
    expect(screen.queryByText('Casa Perla')).toBeNull();
    expect(screen.queryByText('Manicuría Rocío')).toBeNull();
    expect(screen.getByText('Estudio Lila')).toBeTruthy();
    expect(screen.getByText('Salón Aurora')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Inactivos' }));
    expect(screen.getByText('Casa Perla')).toBeTruthy();
    expect(screen.getByText('Manicuría Rocío')).toBeTruthy();
    expect(screen.queryByText('Estudio Lila')).toBeNull();
  });

  it('busca por nombre sin distinguir mayúsculas ni tildes', async () => {
    render(<UsoPage />);
    await screen.findByText('Casa Perla');
    fireEvent.change(screen.getByPlaceholderText('Buscar negocio'), { target: { value: 'rocio' } });
    expect(screen.getByText('Manicuría Rocío')).toBeTruthy();
    expect(screen.queryByText('Casa Perla')).toBeNull();
  });

  it('muestra el error con Reintentar', async () => {
    obtener.mockRejectedValueOnce(new Error('boom'));
    render(<UsoPage />);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Casa Perla')).toBeTruthy());
  });

  it('muestra mensaje si no hay negocios', async () => {
    obtener.mockResolvedValue(respuesta([]));
    render(<UsoPage />);
    expect(await screen.findByText('No hay negocios para mostrar.')).toBeTruthy();
  });
});
