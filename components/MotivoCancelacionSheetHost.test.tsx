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
    expect(screen.queryByText(/^Todos \(/)).toBeNull();
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

  describe('abierta desde una visita (una opción por paso)', () => {
    const visita = {
      pendientes: ['09:00 · con Mauro', '10:30 · con Mengano'],
      pasos: [
        { turnoId: 1, etiqueta: '09:00 · Capping · con Mauro' },
        { turnoId: 2, etiqueta: '10:30 · Soft gel · con Mengano' },
      ],
    };
    const abrir = () => {
      renderWithProviders(<MotivoCancelacionSheetHost />);
      let p!: ReturnType<typeof pedirCancelacionGrupo>;
      act(() => { p = pedirCancelacionGrupo(visita); });
      return () => p;
    };
    const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    it('viene elegido "Todos", lista lo que se cancela y manda alcance grupo', async () => {
      const promesa = abrir();
      expect(screen.getByText('¿Qué se cancela?')).toBeInTheDocument();
      expect(screen.queryByText(/Se cancelará el turno de/)).toBeNull();
      expect(screen.getByRole('button', { name: /^Todos \(/ })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('10:30 · con Mengano')).toBeInTheDocument();
      await confirmar();
      await expect(promesa()).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
    });

    it('ofrece una opción por paso y elegir uno cancela solo ese turno', async () => {
      const promesa = abrir();
      await userEvent.click(screen.getByRole('button', { name: 'Solo 10:30 · Soft gel · con Mengano' }));
      expect(screen.getByRole('button', { name: 'Solo 10:30 · Soft gel · con Mengano' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /^Todos \(/ })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByText('10:30 · con Mengano')).toBeNull();
      await confirmar();
      await expect(promesa()).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'tramo', turnoId: 2 });
    });

    it('se puede volver a "Todos" después de elegir un paso', async () => {
      const promesa = abrir();
      await userEvent.click(screen.getByRole('button', { name: 'Solo 09:00 · Capping · con Mauro' }));
      await userEvent.click(screen.getByRole('button', { name: /^Todos \(/ }));
      await confirmar();
      await expect(promesa()).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
    });

    it('la elección no se arrastra: la siguiente cancelación vuelve a empezar en "Todos"', async () => {
      const primera = abrir();
      await userEvent.click(screen.getByRole('button', { name: 'Solo 10:30 · Soft gel · con Mengano' }));
      await confirmar();
      await primera();
      let p2!: ReturnType<typeof pedirCancelacionGrupo>;
      act(() => { p2 = pedirCancelacionGrupo(visita); });
      expect(screen.getByRole('button', { name: /^Todos \(/ })).toHaveAttribute('aria-pressed', 'true');
      await confirmar();
      await expect(p2).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
    });

    it('no usa jerga en pantalla', () => {
      abrir();
      expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia|combo/i);
    });
  });

  it('cancelar todo el combo lista lo que se cancela y manda alcance grupo', async () => {
    renderWithProviders(<MotivoCancelacionSheetHost />);
    let p!: ReturnType<typeof pedirCancelacionGrupo>;
    act(() => { p = pedirCancelacionGrupo(contexto); });
    await userEvent.click(screen.getByRole('button', { name: /^Todos \(/ }));
    await waitFor(() => expect(screen.getByText('11:00 · con Laura')).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/tramo|paralelo|secuencia/i);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
    await expect(p).resolves.toEqual({ motivo: 'Cliente canceló con aviso', alcance: 'grupo' });
  });
});
