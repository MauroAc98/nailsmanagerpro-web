import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';

const nav = vi.hoisted(() => ({ pathname: '/agenda' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { PRO_NAV_ALTURA, ProNav } from './ProNav';

beforeEach(() => {
  nav.pathname = '/agenda';
});

describe('ProNav', () => {
  it('tiene solo Agenda y Cuenta, dentro de una navegación con nombre', () => {
    renderWithProviders(<ProNav />);
    const navegacion = screen.getByRole('navigation', { name: 'Navegación principal' });
    const enlaces = within(navegacion).getAllByRole('link');
    expect(enlaces.map((a) => a.textContent)).toEqual(['Agenda', 'Cuenta']);
    expect(enlaces[0]).toHaveAttribute('href', '/agenda');
    expect(enlaces[1]).toHaveAttribute('href', '/cuenta');
    enlaces.forEach((a) => expect(a).toHaveStyle({ height: '78px' }));
  });

  it('la barra mide 78 px, tiene esquinas superiores de 20 y sombra hacia arriba', () => {
    renderWithProviders(<ProNav />);
    expect(PRO_NAV_ALTURA).toBe(78);
    expect(screen.getByRole('navigation')).toHaveStyle({ borderRadius: '20px 20px 0 0' });
    expect(screen.getByRole('navigation').style.boxShadow).toContain('--ag-shadow-sheet');
  });

  it('la pestaña activa lleva la burbuja de 60 px con círculo interior de 48 y etiqueta en negrita', () => {
    const { container } = renderWithProviders(<ProNav />);
    const burbuja = screen.getByRole('link', { name: 'Agenda' }).querySelector('.nav-bubble-enter');
    expect(burbuja).toHaveStyle({ width: '60px', height: '60px', borderRadius: '50%' });
    expect(burbuja?.firstElementChild).toHaveStyle({ width: '48px', height: '48px' });
    expect(screen.getByText('Agenda')).toHaveStyle({ fontSize: '11px', fontWeight: '700' });

    expect(screen.getByRole('link', { name: 'Cuenta' }).querySelector('.nav-bubble-enter')).toBeNull();
    expect(screen.getByText('Cuenta')).toHaveStyle({ fontSize: '11px', fontWeight: '400' });
    expect(container.querySelectorAll('.nav-bubble-enter')).toHaveLength(1);
  });

  it('los íconos son decorativos', () => {
    renderWithProviders(<ProNav />);
    screen.getAllByRole('link').forEach((a) => expect(a.querySelector('svg')).toHaveAttribute('aria-hidden', 'true'));
  });

  it('en la agenda marca Agenda como actual', () => {
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cuenta' })).not.toHaveAttribute('aria-current');
  });

  it('en la cuenta marca Cuenta como actual', () => {
    nav.pathname = '/cuenta';
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current');
  });

  it('con prefijo /pro (localhost) arma los enlaces y detecta la ruta activa', () => {
    nav.pathname = '/pro/agenda';
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/pro/agenda');
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('href', '/pro/cuenta');
  });

  it('ya no tiene selector día/mes: la agenda elige fecha desde el calendario', () => {
    renderWithProviders(<ProNav />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no tiene entradas del tenant (clientes, servicios, finanzas, perfil)', () => {
    renderWithProviders(<ProNav />);
    expect(screen.getByRole('navigation').textContent).not.toMatch(/clientes|servicios|gastos|ingresos|estad[ií]sticas|perfil/i);
  });
});
