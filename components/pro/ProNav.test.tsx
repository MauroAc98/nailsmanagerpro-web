import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { useProAgendaStore } from '@/store/useProAgendaStore';

const nav = vi.hoisted(() => ({ pathname: '/agenda' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ProNav } from './ProNav';

beforeEach(() => {
  nav.pathname = '/agenda';
  useProAgendaStore.getState().reset();
});

describe('ProNav', () => {
  it('tiene solo Agenda y Cuenta, dentro de una navegación con nombre', () => {
    renderWithProviders(<ProNav />);
    const navegacion = screen.getByRole('navigation', { name: 'Navegación principal' });
    const enlaces = within(navegacion).getAllByRole('link');
    expect(enlaces.map((a) => a.textContent)).toEqual(['Agenda', 'Cuenta']);
    expect(enlaces[0]).toHaveAttribute('href', '/agenda');
    expect(enlaces[1]).toHaveAttribute('href', '/cuenta');
    enlaces.forEach((a) => expect(a).toHaveStyle({ minHeight: '44px' }));
  });

  it('en la agenda marca Agenda como actual', () => {
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cuenta' })).not.toHaveAttribute('aria-current');
  });

  it('en la cuenta marca Cuenta como actual y no muestra el selector día/mes', () => {
    nav.pathname = '/cuenta';
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('con prefijo /pro (localhost) arma los enlaces y detecta la ruta activa', () => {
    nav.pathname = '/pro/agenda';
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/pro/agenda');
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('href', '/pro/cuenta');
  });

  it('el selector día/mes cambia la vista del store', () => {
    renderWithProviders(<ProNav />);
    const grupo = screen.getByRole('group', { name: 'Vista de la agenda' });
    expect(within(grupo).getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(grupo).getByRole('button', { name: 'Mes' }));
    expect(useProAgendaStore.getState().vista).toBe('mes');
    expect(within(grupo).getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(grupo).getByRole('button', { name: 'Día' }));
    expect(useProAgendaStore.getState().vista).toBe('dia');
  });

  it('no tiene entradas del tenant (clientes, servicios, finanzas, perfil)', () => {
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('navigation').textContent).not.toMatch(/clientes|servicios|gastos|ingresos|estad[ií]sticas|perfil/i);
  });
});
