import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { ServiciosScreen } from './ServiciosScreen';
import { limpiarFlujo, prepararServicio } from './testUtils';

describe('ServiciosScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
  });
  afterEach(() => setServiceParaTests(null));

  // El "Cargando…" de texto plano se ve mal aca tambien: pasa a un esqueleto
  // que respeta la forma real (pastillas de filtro + tarjetas de servicio).
  it('mientras carga, muestra un esqueleto en vez del texto plano "Cargando…"', () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(screen.getByTestId('servicios-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('el esqueleto desaparece apenas los servicios estan listos', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(screen.getByTestId('servicios-skeleton')).toBeInTheDocument();
    await screen.findByText('Kapping gel');
    expect(screen.queryByTestId('servicios-skeleton')).toBeNull();
  });

  it('lista los servicios con duracion y precio "Desde" (referencia, nunca un precio firme)', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Esmaltado semipermanente')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Desde $12.000')).toBeInTheDocument();
    expect(screen.queryByText('$12.000')).toBeNull();
  });

  it('titulo con subtitulo y la nota de que los precios son de referencia', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: '¿Qué te querés hacer?' })).toBeInTheDocument();
    expect(screen.getByText('Podés elegir más de uno.')).toBeInTheDocument();
    expect(
      screen.getByText('Los precios son de referencia: el valor final depende del diseño y se confirma en el negocio.'),
    ).toBeInTheDocument();
  });

  it('sin seleccion, Continuar esta deshabilitado', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await screen.findByText('Kapping gel');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('multi-seleccion: cuenta servicios en el boton, NO muestra ningun total, y guarda en el store', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Retiro de esmalte/ }));
    expect(screen.getByRole('button', { name: 'Continuar · 2 servicios' })).toBeEnabled();
    // 12.000 + 8.000 no se suma: solo aparece el "Desde" de cada tarjeta.
    expect(screen.queryByText('$20.000')).toBeNull();
    expect(screen.getAllByText('Desde $20.000')).toHaveLength(1); // Kapping gel, su propio precio
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
  });

  it('deseleccionar vuelve a deshabilitar Continuar', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    const esmaltado = await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ });
    await userEvent.click(esmaltado);
    await userEvent.click(esmaltado);
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('Continuar navega a horario; volver a la entrada', async () => {
    const ir = vi.fn();
    renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Retiro de esmalte/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo');
  });

  it('restaura la seleccion guardada al montar', async () => {
    const s = useReservaOnlineStore.getState();
    s.activarSlug('demo');
    s.setServicios([3]);
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('checkbox', { name: /Kapping gel/ })).toBeChecked();
  });

  describe('fotos', () => {
    it('un servicio con fotos muestra el link "Ver N fotos"', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Esmaltado semipermanente');
      expect(screen.getByText('Ver 4 fotos ›')).toBeInTheDocument();
      expect(screen.getByText('Ver 6 fotos ›')).toBeInTheDocument();
    });

    // La foto de origen no pasa por ningun recorte al subirla: forzarla a un
    // cuadrado chico con object-fit:cover podia recortarla de forma fea
    // (reportado en produccion). Se saca la miniatura de la tarjeta por
    // completo; la foto se ve entera (sin recortar) recien en el detalle/visor.
    it('no muestra ninguna miniatura de foto en la tarjeta', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Esmaltado semipermanente');
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('un servicio sin fotos es la tarjeta de siempre, sin miniatura ni link de fotos', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      const retiro = (await screen.findByText('Retiro de esmalte')).closest('button') as HTMLElement;
      expect(retiro).toHaveAttribute('role', 'checkbox');
      expect(within(retiro).queryByText(/foto/)).toBeNull();
      expect(screen.queryByRole('button', { name: /Ver fotos de Retiro de esmalte/ })).toBeNull();
    });

    // Antes, tocar el cuerpo de una tarjeta CON fotos abria el detalle en vez
    // de seleccionar (misma tarjeta, dos reglas distintas segun si tenia
    // fotos) — la fuente real de la queja de que la pantalla no era intuitiva.
    // Ahora una unica regla: toda la tarjeta siempre selecciona.
    it('tocar el nombre o la foto de una tarjeta con fotos selecciona, no navega', async () => {
      const ir = vi.fn();
      renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
      await userEvent.click(await screen.findByText('Esmaltado semipermanente'));
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([1]);
      expect(ir).not.toHaveBeenCalled();
    });

    it('el link "Ver fotos" (aparte de la tarjeta) navega al detalle y no cambia la seleccion', async () => {
      const ir = vi.fn();
      renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
      await userEvent.click(await screen.findByRole('button', { name: /Ver fotos de Esmaltado semipermanente/ }));
      expect(ir).toHaveBeenCalledWith('/reservar/demo/servicio/1');
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
    });

    it('tocar la insignia de una tarjeta con fotos tambien selecciona sin navegar', async () => {
      const ir = vi.fn();
      renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
      await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([1]);
      expect(ir).not.toHaveBeenCalled();
    });
  });

  describe('pista de categorias con mas para deslizar', () => {
    function simularDesborde(
      el: HTMLElement,
      { scrollWidth, clientWidth, scrollLeft = 0 }: { scrollWidth: number; clientWidth: number; scrollLeft?: number },
    ) {
      Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
      Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
      Object.defineProperty(el, 'scrollLeft', { configurable: true, value: scrollLeft, writable: true });
    }

    it('si queda contenido oculto a la derecha, muestra la pista', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      const grupo = await screen.findByRole('group', { name: 'Filtrar por categoría' });
      simularDesborde(grupo, { scrollWidth: 600, clientWidth: 350 });
      fireEvent.scroll(grupo);
      expect(screen.getByTestId('pista-categorias')).toBeInTheDocument();
    });

    it('si todas las categorias ya entran, no muestra la pista', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      const grupo = await screen.findByRole('group', { name: 'Filtrar por categoría' });
      simularDesborde(grupo, { scrollWidth: 340, clientWidth: 350 });
      fireEvent.scroll(grupo);
      expect(screen.queryByTestId('pista-categorias')).toBeNull();
    });

    it('al llegar al final del scroll, la pista desaparece', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      const grupo = await screen.findByRole('group', { name: 'Filtrar por categoría' });
      simularDesborde(grupo, { scrollWidth: 600, clientWidth: 350, scrollLeft: 0 });
      fireEvent.scroll(grupo);
      expect(screen.getByTestId('pista-categorias')).toBeInTheDocument();
      simularDesborde(grupo, { scrollWidth: 600, clientWidth: 350, scrollLeft: 250 });
      fireEvent.scroll(grupo);
      expect(screen.queryByTestId('pista-categorias')).toBeNull();
    });
  });

  describe('filtro por categoria', () => {
    it('muestra Todos + una pill por categoria y Otros (hay sin categoria); subtitulo con categoria en Todos', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Kapping gel');
      const grupo = screen.getByRole('group', { name: 'Filtrar por categoría' });
      const nombres = within(grupo).getAllByRole('button').map((b) => b.textContent);
      expect(nombres).toEqual(['Todos', 'Manicura', 'Pedicura', 'Promociones', 'Otros']);
      expect(within(grupo).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByText('Manicura').length).toBeGreaterThan(1); // pill + subtitulo
    });

    it('filtrar oculta los demas, quita el subtitulo y no borra la seleccion; el boton cuenta todos', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
      const grupo = screen.getByRole('group', { name: 'Filtrar por categoría' });
      await userEvent.click(within(grupo).getByRole('button', { name: 'Pedicura' }));
      expect(screen.queryByText('Esmaltado semipermanente')).toBeNull();
      expect(screen.getAllByText('Pedicura')).toHaveLength(1); // solo la pill
      const pedi = screen.getAllByRole('checkbox');
      await userEvent.click(pedi[0]);
      expect(screen.getByRole('button', { name: 'Continuar · 2 servicios' })).toBeEnabled();
      await userEvent.click(within(grupo).getByRole('button', { name: 'Todos' }));
      expect(useReservaOnlineStore.getState().servicioIds).toHaveLength(2);
      expect(screen.getByRole('checkbox', { name: /Esmaltado semipermanente/ })).toHaveAttribute('aria-checked', 'true');
    });

    it('Otros muestra los sin categoria', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Kapping gel');
      const grupo = screen.getByRole('group', { name: 'Filtrar por categoría' });
      await userEvent.click(within(grupo).getByRole('button', { name: 'Otros' }));
      expect(screen.getByText('Retiro de esmalte')).toBeInTheDocument();
      expect(screen.queryByText('Kapping gel')).toBeNull();
    });

    it('sin ninguna categoria: sin pills ni subtitulo', async () => {
      const svc = prepararServicio();
      const original = svc.getServices.bind(svc);
      svc.getServices = async (slug, q) => (await original(slug, q)).map((s) => ({ ...s, categoria: null }));
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Kapping gel');
      expect(screen.queryByRole('group', { name: 'Filtrar por categoría' })).toBeNull();
      expect(screen.queryByText('Manicura')).toBeNull();
    });
  });
});
