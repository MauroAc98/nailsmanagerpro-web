import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { DisponibilidadDia } from '@/services/turnoService';
import { StoryCanvas } from './StoryCanvas';

// StoryCanvas se captura tal cual con html-to-image (ver comentarios del
// componente): esta prueba solo cubre el badge nuevo del logo del negocio,
// no re-verifica todo el resto del canvas (sin cobertura previa).
function renderCanvas(logoUrl: string | null) {
  const dias: DisponibilidadDia[] = [{ fecha: '2026-09-24', slots: [{ hora: '10hs', libre: true }] }];
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <StoryCanvas
        ref={createRef()}
        titulo="24 de sept"
        nombreEstudio="Turnetto"
        telefonoEstudio={null}
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

describe('StoryCanvas — badge del logo del negocio', () => {
  it('con logoUrl, muestra la foto del negocio en blanco y negro a la izquierda del chip de fecha', () => {
    renderCanvas('https://cdn.turnetto.com/logo.jpg');
    // El fondo también usa <img alt="">, así que se identifica el logo por
    // su src — y se verifica el filtro grayscale, que es lo que pide el
    // negocio ("en blanco y negro").
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo.jpg'));
    expect(logos).toHaveLength(1);
    expect((logos[0] as HTMLImageElement).style.filter).toContain('grayscale');
  });

  it('sin logoUrl (negocio sin foto subida), no rompe: el chip de fecha se ve igual que antes', () => {
    renderCanvas(null);
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo'));
    expect(logos).toHaveLength(0);
    expect(screen.getByText('24')).toBeInTheDocument(); // chipDiaNumero sigue mostrándose
  });
});
