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

describe('StoryCanvas — línea "con {profesional}" en el header', () => {
  it('sin profesional elegida: título del negocio, "Turnos disponibles" y la fecha, sin línea "con"', () => {
    renderCanvas(null, unDia);
    expect(screen.getByText('Turnetto')).toBeInTheDocument();
    expect(screen.getByText('TURNOS DISPONIBLES')).toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });

  it('con profesional elegida: título, "Turnos disponibles", "con Natalia" y la fecha, en ese orden', () => {
    renderCanvas(null, unDia, 'Natalia');
    expect(screen.getByText('Turnetto')).toBeInTheDocument();
    const leyenda = screen.getByText('TURNOS DISPONIBLES');
    const con = screen.getByText('con Natalia');
    const fecha = screen.getByText('24 de sept');
    // DOCUMENT_POSITION_FOLLOWING (4): el segundo nodo viene después del primero.
    expect(leyenda.compareDocumentPosition(con) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(con.compareDocumentPosition(fecha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // El nombre no pasa a ser el título grande.
    expect(screen.queryByText('Natalia')).not.toBeInTheDocument();
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
    expect(screen.queryByText('con Natalia')).not.toBeInTheDocument();
  });

  it('si la profesional se llama igual que el negocio no se repite el nombre', () => {
    renderCanvas(null, unDia, 'Turnetto');
    expect(screen.getByText('TURNOS DISPONIBLES')).toBeInTheDocument();
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
  });
});
