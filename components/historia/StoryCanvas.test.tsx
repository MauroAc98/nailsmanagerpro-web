import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { DisponibilidadDia } from '@/services/turnoService';
import { StoryCanvas } from './StoryCanvas';

// StoryCanvas se captura tal cual con html-to-image (ver comentarios del
// componente): esta prueba solo cubre el reemplazo del chip de fecha /
// ícono genérico por el logo del negocio, no re-verifica todo el resto del
// canvas (sin cobertura previa).
function renderCanvas(logoUrl: string | null, dias: DisponibilidadDia[], profesionalNombre?: string) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <StoryCanvas
        ref={createRef()}
        titulo="24 de sept"
        nombreEstudio="Turnetto"
        telefonoEstudio={null}
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

describe('StoryCanvas — header con profesional elegida (diseño A)', () => {
  it('sin profesional elegida: título del negocio, "TURNOS DISPONIBLES" y la fecha, sin línea "con"', () => {
    renderCanvas(null, unDia);
    expect(screen.getByText('Turnetto')).toBeInTheDocument();
    expect(screen.getByText('TURNOS DISPONIBLES')).toBeInTheDocument();
    expect(screen.getByText('24 de sept')).toBeInTheDocument();
    expect(screen.queryByText('Turnos disponibles')).not.toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });

  it('con profesional elegida: título "Turnos disponibles" y una sola línea "con Gabriela · fecha"', () => {
    renderCanvas(null, unDia, 'Gabriela');
    expect(screen.getByText('Turnos disponibles')).toBeInTheDocument();
    expect(screen.getByText('con Gabriela · 24 de sept')).toBeInTheDocument();
    // La leyenda en mayúsculas y la fecha suelta ya no van aparte.
    expect(screen.queryByText('TURNOS DISPONIBLES')).not.toBeInTheDocument();
    expect(screen.queryByText('24 de sept')).not.toBeInTheDocument();
  });

  it('con profesional elegida el nombre del negocio ya no es el título: baja al pie, en una sola línea', () => {
    renderCanvas(null, unDia, 'Gabriela');
    const negocio = screen.getAllByText('Turnetto');
    expect(negocio).toHaveLength(1);
    // Está en el pie: viene después de la línea "con …" en el documento.
    const con = screen.getByText('con Gabriela · 24 de sept');
    expect(con.compareDocumentPosition(negocio[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con profesional elegida y teléfono, el pie une negocio y teléfono en una sola línea', () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <StoryCanvas
          ref={createRef()}
          titulo="24 de sept"
          nombreEstudio="Turnetto"
          telefonoEstudio="5491155551234"
          profesionalNombre="Gabriela"
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
    expect(screen.getByText(/^Turnetto · \+/)).toBeInTheDocument();
  });

  it('si el nombre del negocio ya contiene el de la profesional no se repite ("Natalia Acosta Studio" con Natalia)', () => {
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
    // Header de siempre: negocio de título, leyenda y fecha sueltas, sin "con".
    expect(screen.getByText('Natalia Acosta Studio')).toBeInTheDocument();
    expect(screen.getByText('TURNOS DISPONIBLES')).toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });

  it('si la profesional se llama igual que el negocio no se repite el nombre', () => {
    renderCanvas(null, unDia, 'Turnetto');
    expect(screen.getByText('TURNOS DISPONIBLES')).toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });
});
