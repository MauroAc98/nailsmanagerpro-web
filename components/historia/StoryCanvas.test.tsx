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
function renderCanvas(logoUrl: string | null, dias: DisponibilidadDia[], profesionalNombre?: string, telefono: string | null = null, filtroServicios?: { titulo: string; servicios: string[] }) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <StoryCanvas
        ref={createRef()}
        titulo="24 de sept"
        nombreEstudio="Turnetto"
        telefonoEstudio={telefono}
        profesionalNombre={profesionalNombre}
        filtroServicios={filtroServicios}
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

  it('modo semana, sin logoUrl: el círculo muestra mes y año del primer día, no un ícono genérico', () => {
    renderCanvas(null, variosDias);
    expect(screen.getByText('Sept')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    // El "24" aparece una sola vez: es el número de la fila de la lista, no un chip de fecha.
    expect(screen.getAllByText('24')).toHaveLength(1);
  });

  it('modo semana: cada día separa la abreviatura del número, y las horas el número del "hs"', () => {
    renderCanvas(null, variosDias);
    const dias = screen.getAllByTestId('story-dia');
    expect(dias).toHaveLength(2);
    expect(dias[0]).toHaveTextContent(/^JUE24$/);
    const horas = screen.getAllByTestId('story-horas')[0];
    expect(horas).toHaveTextContent('10hs');
    expect(screen.getAllByTestId('story-unidad')[0]).toHaveTextContent('hs');
  });

  it('modo semana: el "hs" aparece una sola vez por día, no en cada hora, y una línea de puntos une día y horas', () => {
    const dosHoras: DisponibilidadDia[] = [
      { fecha: '2026-09-24', slots: [{ hora: '10hs', libre: true }, { hora: '14hs', libre: true }, { hora: '16hs', libre: true }] },
      { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
    ];
    renderCanvas(null, dosHoras);
    const [primera] = screen.getAllByTestId('story-horas');
    // El aire entre horas es margen (no espacios de texto).
    expect(primera.textContent).toBe('10·14·16hs');
    expect(primera.querySelectorAll('[data-testid="story-unidad"]')).toHaveLength(1);
    const fila = screen.getAllByTestId('story-dia')[0].parentElement as HTMLElement;
    expect((fila.children[1] as HTMLElement).style.borderBottom).toContain('dotted');
  });

  it('modo semana: horas con minutos ("9:30hs") conservan los minutos y comparten un solo "hs"', () => {
    renderCanvas(null, [
      { fecha: '2026-09-24', slots: [{ hora: '9hs', libre: true }, { hora: '9:30hs', libre: true }, { hora: '14:30hs', libre: true }] },
      { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
    ]);
    const [primera] = screen.getAllByTestId('story-horas');
    expect(primera.textContent).toBe('9·9:30·14:30hs');
    expect(primera.querySelectorAll('[data-testid="story-unidad"]')).toHaveLength(1);
  });

  it('modo semana: si una hora no termina en "hs" se muestran todas tal cual, sin unidad suelta', () => {
    renderCanvas(null, [
      { fecha: '2026-09-24', slots: [{ hora: '10:30', libre: true }, { hora: '14hs', libre: true }] },
      { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
    ]);
    const [primera] = screen.getAllByTestId('story-horas');
    expect(primera.textContent).toBe('10:30·14hs');
    expect(primera.querySelector('[data-testid="story-unidad"]')).toBeNull();
  });

  it('modo semana: entre horas del mismo día hay un punto medio tenue, y ninguno al borde', () => {
    const dosHoras: DisponibilidadDia[] = [
      { fecha: '2026-09-24', slots: [{ hora: '10hs', libre: true }, { hora: '14hs', libre: true }] },
      { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
    ];
    renderCanvas(null, dosHoras);
    expect(screen.getAllByTestId('story-separador-hora')).toHaveLength(1);
    const texto = screen.getAllByTestId('story-horas')[0].textContent ?? '';
    expect(texto.startsWith('·')).toBe(false);
    expect(texto.endsWith('·')).toBe(false);
  });

  it('modo semana: un día sin horas libres dice "Completo"', () => {
    renderCanvas(null, [
      { fecha: '2026-09-24', slots: [{ hora: '10hs', libre: false }] },
      { fecha: '2026-09-25', slots: [{ hora: '11hs', libre: true }] },
    ]);
    expect(screen.getByText('Completo')).toBeInTheDocument();
  });

  it('la foto es un círculo con anillo hecho de bordes (nunca filter ni box-shadow)', () => {
    renderCanvas('https://cdn.turnetto.com/logo.jpg', unDia);
    const logo = screen.getAllByAltText('').find(img => (img as HTMLImageElement).src.includes('logo.jpg')) as HTMLImageElement;
    expect(logo.style.borderRadius).toBe('50%');
    // Safari (html-to-image -> SVG foreignObject) pinta mal el halo de un box-shadow con
    // spread sobre un elemento redondeado: lo dibuja relleno y tapa parte de la foto
    // (real en prod 2026-10-13). El anillo se arma con dos bordes concéntricos.
    expect(logo.style.boxShadow).toBe('');
    const insignia = screen.getByTestId('story-insignia');
    expect(insignia.style.boxShadow).toBe('');
    const anillos = insignia.querySelectorAll('[data-anillo]');
    expect(anillos).toHaveLength(2);
    for (const a of Array.from(anillos) as HTMLElement[]) {
      expect(a.style.borderRadius).toBe('50%');
      expect(a.style.boxShadow).toBe('');
      expect(a.style.borderStyle).toBe('solid');
    }
  });

  it('el chip de fecha (sin foto) también arma su anillo con bordes, sin box-shadow', () => {
    renderCanvas(null, unDia);
    const insignia = screen.getByTestId('story-insignia');
    expect(insignia.querySelectorAll('[data-anillo]')).toHaveLength(2);
    expect(insignia.innerHTML).not.toMatch(/box-shadow/);
  });

  it('modo día, sin logoUrl (negocio sin foto subida): se ve el chip de fecha de siempre', () => {
    renderCanvas(null, unDia);
    const logos = screen.getAllByAltText('').filter(img => (img as HTMLImageElement).src.includes('logo'));
    expect(logos).toHaveLength(0);
    expect(screen.getByText('24')).toBeInTheDocument();
  });
});

describe('StoryCanvas — servicios elegidos (M1: categoría en el título + bajada)', () => {
  const filtro = { titulo: 'Uñas y Pestañas', servicios: ['Esmaltado', 'Kapping', 'Lifting'] };
  const ocho = {
    titulo: 'Depilación',
    servicios: ['Cera piernas', 'Media pierna', 'Cavado', 'Axilas', 'Bozo', 'Brazos', 'Espalda', 'Glúteos'],
  };
  const quincena: DisponibilidadDia[] = Array.from({ length: 16 }, (_, i) => ({
    fecha: `2026-10-${String(i + 16).padStart(2, '0')}`, slots: [{ hora: '10hs', libre: true }],
  }));
  const gapLista = () => Number.parseFloat((screen.getByTestId('story-lista') as HTMLElement).style.gap);
  // Espacio entre el encabezado y la lista: aire arriba de la línea + línea + aire abajo.
  const margenTotal = () =>
    Number.parseFloat((screen.getByTestId('story-linea-encabezado') as HTMLElement).style.marginTop)
    + 1
    + Number.parseFloat((screen.getByTestId('story-cuerpo') as HTMLElement).style.marginTop);

  it('el título nombra la categoría (en cursiva) y la etiqueta lleva fecha y profesional', () => {
    renderCanvas(null, unDia, 'Gabriela', null, filtro);
    const titulo = screen.getByTestId('story-titulo');
    expect(titulo).toHaveTextContent('Turnos de Uñas y Pestañas');
    expect(titulo.querySelector('em')).toHaveTextContent('Uñas y Pestañas');
    expect(screen.getByTestId('story-kicker')).toHaveTextContent(/24 de sept\s*con Gabriela/);
    expect(titulo).not.toHaveTextContent('disponibles');
  });

  it('los servicios van como bajada tal cual se escriben, sin etiqueta ni línea', () => {
    renderCanvas(null, unDia, 'Gabriela', null, filtro);
    const bajada = screen.getByTestId('story-servicios');
    expect(bajada.textContent).toContain('Esmaltado');
    expect(bajada.textContent).toContain('Lifting');
    expect(bajada.textContent).not.toContain('ESMALTADO');
    expect(bajada.style.maxHeight).toBe('42px');
    expect(screen.queryByTestId('story-etiqueta-categoria')).not.toBeInTheDocument();
    expect(screen.queryByTestId('story-servicios-linea')).not.toBeInTheDocument();
  });

  it('una categoría con muchos servicios usa hasta 3 renglones y la lista de quincena sigue entrando', () => {
    const muchos = {
      titulo: 'Pestañas',
      servicios: [
        'Extensiones clásicas', 'Extensiones volumen ruso', 'Service / Retoque', 'Lifting de pestañas',
        'Tintura de pestañas', 'Laminado de cejas', 'Diseño de cejas', 'Henna de cejas',
      ],
    };
    renderCanvas(null, quincena, 'Gabriela', null, muchos);
    const renglones = screen.getByTestId('story-servicios').children.length;
    expect(renglones).toBe(3);
    // El alto que suma la tercera línea sale de los espacios entre filas, que no bajan del mínimo.
    expect(gapLista()).toBeGreaterThanOrEqual(2);
  });

  it('cada renglón de la bajada es un bloque sin cortes y ninguno empieza ni termina en un separador', () => {
    renderCanvas(null, unDia, 'Gabriela', null, ocho);
    const renglones = Array.from(screen.getByTestId('story-servicios').children) as HTMLElement[];
    expect(renglones.length).toBeGreaterThan(0);
    expect(renglones.length).toBeLessThanOrEqual(3);
    for (const r of renglones) {
      expect(r.style.whiteSpace).toBe('nowrap');
      expect(r.firstElementChild).not.toHaveAttribute('data-testid', 'story-separador');
      expect(r.lastElementChild).not.toHaveAttribute('data-testid', 'story-separador');
    }
    // Entre dos servicios del mismo renglón hay exactamente un separador.
    const separadores = screen.getAllByTestId('story-separador').length;
    const servicios = renglones.reduce((n, r) => n + r.querySelectorAll(':scope > span:not([data-testid])').length, 0);
    expect(separadores).toBe(servicios - renglones.length);
  });

  it('en quincena el alto extra sale del margen y de los espacios entre filas', () => {
    const { unmount } = renderCanvas(null, quincena, 'Gabriela');
    const gapSin = gapLista();
    const margenSin = margenTotal();
    unmount();
    renderCanvas(null, quincena, 'Gabriela', null, ocho);
    // Margen con servicios: 18 + los 4px que subió el encabezado.
    expect(margenTotal()).toBe(22);
    // Bajada: 10px de separación + N renglones de 14px.
    const altoBajada = 10 + 14 * screen.getByTestId('story-servicios').children.length;
    expect(15 * (gapSin - gapLista())).toBeCloseTo(altoBajada + margenTotal() - margenSin, 0);
  });

  it('vista de equipo (sin profesional): la línea chica es solo la fecha', () => {
    renderCanvas(null, unDia, undefined, null, filtro);
    expect(screen.getByTestId('story-titulo')).toHaveTextContent('Turnos de Uñas y Pestañas');
    expect(screen.getByTestId('story-kicker')).toHaveTextContent('24 de sept');
    expect(screen.getByTestId('story-kicker')).not.toHaveTextContent('con');
  });

  it('sin servicios el encabezado y la lista quedan como en producción', () => {
    renderCanvas(null, unDia, 'Gabriela', null, { titulo: 'Servicios', servicios: [] });
    expect(screen.getByTestId('story-titulo')).toHaveTextContent('Turnos disponibles');
    expect(screen.queryByTestId('story-servicios')).not.toBeInTheDocument();
  });
});

describe('StoryCanvas — línea entre el encabezado y la lista', () => {
  const filtro = { titulo: 'Depilación', servicios: ['Cera piernas', 'Cavado'] };
  const margenTotal = () =>
    Number.parseFloat((screen.getByTestId('story-linea-encabezado') as HTMLElement).style.marginTop)
    + 1
    + Number.parseFloat((screen.getByTestId('story-cuerpo') as HTMLElement).style.marginTop);

  it('hay una línea fina entre el encabezado y la lista', () => {
    renderCanvas(null, variosDias, 'Gabriela');
    const linea = screen.getByTestId('story-linea-encabezado') as HTMLElement;
    expect(linea.style.height).toBe('1px');
    const cuerpo = screen.getByTestId('story-cuerpo');
    expect(linea.compareDocumentPosition(cuerpo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el encabezado sube 4px: el contenido arranca 4px antes de la zona segura', () => {
    renderCanvas(null, variosDias, 'Gabriela');
    const contenido = screen.getByTestId('story-contenido') as HTMLElement;
    expect(Number.parseFloat(contenido.style.paddingTop)).toBe(safeAreaInsets(640).top - 4);
  });

  it('sin servicios el espacio entre encabezado y lista suma los 4px que subió, así la lista no se mueve', () => {
    renderCanvas(null, variosDias, 'Gabriela');
    expect(margenTotal()).toBe(Math.round(640 * 0.06) + 4);
  });

  it('con servicios también, y la línea queda centrada en ese espacio', () => {
    renderCanvas(null, variosDias, 'Gabriela', null, filtro);
    expect(margenTotal()).toBe(18 + 4);
    const arriba = Number.parseFloat((screen.getByTestId('story-linea-encabezado') as HTMLElement).style.marginTop);
    const abajo = Number.parseFloat((screen.getByTestId('story-cuerpo') as HTMLElement).style.marginTop);
    expect(Math.abs(arriba - abajo)).toBeLessThanOrEqual(1);
  });
});

describe('StoryCanvas — diseño único (siempre con la profesional)', () => {
  it('título "Turnos disponibles" y una etiqueta "fecha — con Gabriela" arriba', () => {
    renderCanvas(null, unDia, 'Gabriela');
    const titulo = screen.getByTestId('story-titulo');
    expect(titulo).toHaveTextContent('Turnos disponibles');
    expect(titulo.querySelector('em')).toHaveTextContent('disponibles');
    const etiqueta = screen.getByTestId('story-kicker');
    expect(etiqueta).toHaveTextContent(/24 de sept\s*con Gabriela/);
    // El nombre de la profesional va en negrita; la etiqueta está sobre el título.
    expect(etiqueta.querySelector('b')).toHaveTextContent('Gabriela');
    expect(etiqueta.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Ya no existe el encabezado "solo negocio": ni la leyenda en mayúsculas.
    expect(screen.queryByText('TURNOS DISPONIBLES')).not.toBeInTheDocument();
  });

  it('sin profesional resuelta, el mismo diseño con solo la fecha (sin "con")', () => {
    renderCanvas(null, unDia);
    expect(screen.getByTestId('story-titulo')).toHaveTextContent('Turnos disponibles');
    expect(screen.getByTestId('story-kicker')).toHaveTextContent('24 de sept');
    expect(screen.queryByText(/^con /)).not.toBeInTheDocument();
    expect(screen.getByTestId('story-kicker')).not.toHaveTextContent('con');
  });

  it('el nombre del negocio nunca es el título: va al pie, una sola vez', () => {
    renderCanvas(null, unDia, 'Gabriela');
    const negocio = screen.getAllByText('Turnetto');
    expect(negocio).toHaveLength(1);
    const con = screen.getByTestId('story-kicker');
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
    expect(screen.getByTestId('story-kicker')).toHaveTextContent(/24 de sept\s*con Natalia/);
    expect(screen.getByText('Natalia Acosta Studio')).toBeInTheDocument();
  });

  it('con teléfono, el pie pone el negocio a la izquierda y el teléfono a la derecha, sin ícono', () => {
    renderCanvas(null, unDia, 'Gabriela', '5491155551234');
    const negocio = screen.getByText('Turnetto');
    const telefono = screen.getByText(/^\+/);
    // Misma fila: negocio primero (columna que crece), después el teléfono.
    const fila = telefono.parentElement as HTMLElement;
    expect(fila.contains(negocio)).toBe(true);
    expect(negocio.compareDocumentPosition(telefono) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fila.style.display).toBe('flex');
    // Sin ícono de WhatsApp en el pie: solo texto.
    expect(fila.querySelector('svg')).toBeNull();
  });

  // El nombre baja de renglón antes que cortarse, y el teléfono nunca se parte
  // ni cede ancho: ocupa lo que necesita pegado al borde derecho.
  it('el pie no recorta el nombre con "…" y el teléfono no se parte ni se achica', () => {
    renderCanvas(null, unDia, 'Gabriela', '5491155551234');
    const negocio = screen.getByText('Turnetto');
    const telefono = screen.getByText(/^\+/);
    expect(negocio.style.overflow).not.toBe('hidden');
    expect(negocio.style.textOverflow).not.toBe('ellipsis');
    expect(telefono.style.whiteSpace).toBe('nowrap');
    expect(telefono.style.flexShrink).toBe('0');
    // La columna del nombre puede achicarse (minWidth 0) para dejarle lugar al teléfono.
    expect(Number.parseFloat((negocio.parentElement as HTMLElement).style.minWidth)).toBe(0);
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
