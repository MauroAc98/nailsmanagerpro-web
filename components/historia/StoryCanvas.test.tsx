import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { DisponibilidadDia } from '@/services/turnoService';
import { safeAreaInsets } from '@/lib/historia/safeArea';
import { StoryCanvas } from './StoryCanvas';

// StoryCanvas se captura tal cual con html-to-image (ver comentarios del
// componente): esta prueba solo cubre el reemplazo del chip de fecha /
// ícono genérico por el logo del negocio, no re-verifica todo el resto del
// canvas (sin cobertura previa).
function renderCanvas(logoUrl: string | null, dias: DisponibilidadDia[], profesionalNombre?: string, telefono: string | null = null) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <StoryCanvas
        ref={createRef()}
        titulo="24 de sept"
        nombreEstudio="Turnetto"
        telefonoEstudio={telefono}
        profesionalNombre={profesionalNombre}
        logoUrl={logoUrl}
        dias={dias}
        fondoUri={null}
        canvasWidth={360}
        canvasHeight={640}
        textosLibres={[]}
        onMoverTexto={() => {}}
        onResizeTexto={() => {}}
        onEditarTexto={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

const unDia: DisponibilidadDia[] = [{ fecha: '2026-09-24', slots: [{ hora: '10hs', libre: true }] }];
const variosDias: DisponibilidadDia[] = [
  { fecha: '2026-09-24', slots: [{ hora: '10hs', libre: true }] },
  { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
];

describe('StoryCanvas — logo del negocio en el lugar del chip de fecha / ícono', () => {
  it('modo día, con logoUrl: la foto reemplaza el chip de fecha', () => {
    renderCanvas('https://cdn.turnetto.com/logo.jpg', unDia);
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo.jpg'));
    expect(logos).toHaveLength(1);
    // Sin ningún `filter` en vivo acá a propósito: un filtro CSS en este
    // árbol es lo que rompía la captura en Safari (ver StoryCanvas.tsx).
    expect((logos[0] as HTMLImageElement).style.filter).toBe('');
    // El chip de fecha (el "24" del día) no debe verse duplicado ni convivir
    // con el logo en el header — el logo lo reemplaza, no lo acompaña.
    expect(screen.queryByText('24')).not.toBeInTheDocument();
  });

  it('modo semana, con logoUrl: la foto reemplaza el ícono genérico también ahí', () => {
    renderCanvas('https://cdn.turnetto.com/logo.jpg', variosDias);
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo.jpg'));
    expect(logos).toHaveLength(1);
  });

  it('modo día, sin logoUrl (negocio sin foto subida): se ve el chip de fecha de siempre', () => {
    renderCanvas(null, unDia);
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo'));
    expect(logos).toHaveLength(0);
    expect(screen.getByText('24')).toBeInTheDocument();
  });
});

describe('StoryCanvas — diseño único (siempre con la profesional)', () => {
  it('título "Turnos disponibles" y una sola línea "con Gabriela · fecha"', () => {
    renderCanvas(null, unDia, 'Gabriela');
    expect(screen.getByText('Turnos disponibles')).toBeInTheDocument();
    expect(screen.getByText('con Gabriela · 24 de sept')).toBeInTheDocument();
    // Ya no existe el encabezado "solo negocio": ni la leyenda en mayúsculas
    // ni la fecha suelta.
    expect(screen.queryByText('TURNOS DISPONIBLES')).not.toBeInTheDocument();
    expect(screen.queryByText('24 de sept')).not.toBeInTheDocument();
  });

  it('sin profesional resuelta, el mismo diseño con solo la fecha (sin "con")', () => {
    renderCanvas(null, unDia);
    expect(screen.getByText('Turnos disponibles')).toBeInTheDocument();
    expect(screen.getByText('24 de sept')).toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });

  it('el nombre del negocio nunca es el título: va al pie, una sola vez', () => {
    renderCanvas(null, unDia, 'Gabriela');
    const negocio = screen.getAllByText('Turnetto');
    expect(negocio).toHaveLength(1);
    const con = screen.getByText('con Gabriela · 24 de sept');
    expect(con.compareDocumentPosition(negocio[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('aunque el negocio lleve el nombre de la profesional ("Natalia Acosta Studio" con Natalia) mantiene el mismo diseño', () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <StoryCanvas
          ref={createRef()}
          titulo="24 de sept"
          nombreEstudio="Natalia Acosta Studio"
          telefonoEstudio={null}
          profesionalNombre="Natalia"
          logoUrl={null}
          dias={unDia}
          fondoUri={null}
          canvasWidth={360}
          canvasHeight={640}
          textosLibres={[]}
          onMoverTexto={() => {}}
          onResizeTexto={() => {}}
          onEditarTexto={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('con Natalia · 24 de sept')).toBeInTheDocument();
    expect(screen.getByText('Natalia Acosta Studio')).toBeInTheDocument();
  });

  it('con teléfono, el pie une negocio y teléfono en una línea, sin ícono', () => {
    renderCanvas(null, unDia, 'Gabriela', '5491155551234');
    const negocio = screen.getByText('Turnetto');
    const telefono = screen.getByText(/^\+/);
    // Misma fila: negocio primero, después el grupo "ícono + teléfono".
    const fila = negocio.parentElement as HTMLElement;
    expect(fila.contains(telefono)).toBe(true);
    expect(negocio.compareDocumentPosition(telefono) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Sin ícono de WhatsApp en el pie: solo texto.
    expect(fila.querySelector('svg')).toBeNull();
  });

  // Nombre (serif) y teléfono (otra tipografía) en cajas flex distintas se
  // veían corridos: el nombre quedaba más abajo y fuera de la línea del
  // teléfono. Como texto corrido en una sola línea (inline) comparten la misma
  // línea base por construcción, sin depender de cómo cada fuente arma su caja.
  it('el pie pone nombre, guion y teléfono como texto corrido en la misma línea (no en cajas flex)', () => {
    renderCanvas(null, unDia, 'Gabriela', '5491155551234');
    const negocio = screen.getByText('Turnetto');
    const telefono = screen.getByText(/^\+/);
    const fila = negocio.parentElement as HTMLElement;
    const guion = fila.querySelector('[aria-hidden]') as HTMLElement;

    // Misma línea de texto: el contenedor no es flex y los tres son inline.
    expect(fila.style.display).not.toBe('flex');
    for (const el of [negocio, guion, telefono]) {
      expect(el.parentElement).toBe(fila);
      expect(['', 'inline']).toContain(el.style.display);
    }
    // La altura de línea la define la fila, igual para los tres.
    expect(fila.style.lineHeight).not.toBe('');
    for (const el of [negocio, guion, telefono]) expect(el.style.lineHeight).toBe('');
    // El nombre no se recorta con "…" (no overflow hidden) y el teléfono no se parte.
    expect(negocio.style.overflow).not.toBe('hidden');
    expect(negocio.style.textOverflow).not.toBe('ellipsis');
    expect(telefono.style.whiteSpace).toBe('nowrap');
  });
});

describe('StoryCanvas — franja desenfocada del pie arranca en la línea divisoria', () => {
  let observadores: Array<() => void> = [];
  let topLinea = 520;
  let conLayout = true;

  beforeEach(() => {
    observadores = [];
    topLinea = 520;
    conLayout = true;
    // jsdom no calcula layout: simulamos ResizeObserver (avisa al observar) y
    // las posiciones del canvas (640 de alto) y de la línea divisoria.
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: () => void) { observadores.push(cb); }
      observe() { this.cb(); }
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const id = this.getAttribute('data-testid');
      const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
      if (!conLayout) return rect(0, 0);
      if (id === 'story-raiz') return rect(0, 640);
      if (id === 'story-linea') return rect(topLinea, topLinea + 1);
      return rect(0, 0);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('la franja mide desde la línea hasta el borde inferior del canvas', () => {
    renderCanvas(null, unDia, 'Gabriela');
    expect(screen.getByTestId('story-zona-pie').style.height).toBe('120px');
  });

  it('si el pie crece y la línea sube, la franja la sigue', () => {
    renderCanvas(null, unDia, 'Gabriela');
    topLinea = 480;
    act(() => observadores.forEach(cb => cb()));
    expect(screen.getByTestId('story-zona-pie').style.height).toBe('160px');
  });

  it('sin layout real usa el alto por defecto en vez de colapsar la franja', () => {
    conLayout = false;
    renderCanvas(null, unDia, 'Gabriela');
    const porDefecto = safeAreaInsets(640).bottom + Math.round(640 * 0.10);
    expect(screen.getByTestId('story-zona-pie').style.height).toBe(`${porDefecto}px`);
  });
});
