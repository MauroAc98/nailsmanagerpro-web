import { afterEach, describe, expect, it } from 'vitest';
import { act, renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { MotivoCancelacionSheetHost } from './MotivoCancelacionSheetHost';
import { pedirCancelacionGrupo, pedirMotivoCancelacion, useMotivoCancelacionStore } from '@/store/useMotivoCancelacionStore';

afterEach(() => useMotivoCancelacionStore.setState({ visible: false, resolve: null, contexto: null }));

const contexto = { esteTurno: 'Softgel · con Ana', pendientes: ['10:00 · con Ana', '11:00 · con Laura'] };

describe('MotivoCancelacionSheetHost', () => {
  it('sin grupo es el sheet de siempre: sin opciones de alcance y resuelve el motivo (Rule L)', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: Promise<string | null>;
    act(() => { p = pedirMotivoCancelacion(); });
    expect(screen.queryByText(/Todo el grupo/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toBe('Cliente canceló con aviso');
  });

  it('con grupo nombra el turno y por defecto cancela solo ese', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p = pedirCancelacionGrupo(contexto); });
    expect(screen.getByText('Se cancelará el turno de Softgel · con Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'tramo' });
  });

  it('abierto desde una visita no ofrece "solo este turno": viene elegido todo y manda alcance grupo', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p = pedirCancelacionGrupo({ pendientes: contexto.pendientes, alcanceInicial: 'grupo' }); });
    expect(screen.queryByText(/Solo este turno/)).toBeNull();
    expect(screen.queryByText(/Se cancelará el turno de/)).toBeNull();
    expect(screen.getByRole('button', { name: /Todo el grupo/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('11:00 · con Laura')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
  });

  it('con alcance inicial grupo y un turno nombrado viene elegido todo, pero se puede pasar a solo ese', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p = pedirCancelacionGrupo({ ...contexto, alcanceInicial: 'grupo' }); });
    expect(screen.getByRole('button', { name: /Todo el grupo/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Solo este turno/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'tramo' });
  });

  it('el alcance inicial no se arrastra: la siguiente cancelacion de un turno vuelve a empezar en solo ese', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p1!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p1 = pedirCancelacionGrupo({ pendientes: contexto.pendientes, alcanceInicial: 'grupo' }); });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await p1;
    let p2!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p2 = pedirCancelacionGrupo(contexto); });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p2).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'tramo' });
  });

  it('cancelar todo el combo lista lo que se cancela y manda alcance grupo', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p = pedirCancelacionGrupo(contexto); });
    await userEvent.click(screen.getByRole('button', { name: /Todo el grupo/ }));
    await waitFor(() => expect(screen.getByText('11:00 · con Laura')).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia/i);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
  });
});
