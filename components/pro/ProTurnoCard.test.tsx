import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProTurno } from '@/lib/pro/tipos';
import { ProTurnoCard } from './ProTurnoCard';

function turno(extra: Partial<ProTurno> = {}): ProTurno {
  return {
    id: 7,
    fecha_hora: '2026-10-17T09:30:00',
    duracion_total_minutos: 90,
    estado_visual: 'confirmado',
    notas: null,
    cliente: { nombre: 'Lucía', apellido: 'Gómez' },
    servicios: [{ id: 1, nombre: 'Esmaltado semipermanente' }],
    promo: null,
    ...extra,
  };
}

describe('ProTurnoCard — privacidad', () => {
  const hostil = {
    ...turno(),
    telefono: '+5491155550000',
    cliente: { nombre: 'Lucía', apellido: 'Gómez', telefono: '1155551234', email: 'secreto@x.com', whatsapp: 'wa-SECRETO' },
    precio: 98765,
    sena: 4321,
    pagos: [{ monto: 1234567 }],
    whatsapp: 'wa-OCULTO',
    servicios: [{ id: 1, nombre: 'Esmaltado', precio: 55555 }],
    promo: { nombre: 'Promo mayo', precio: 66666 },
  };

  it('ningún dato sensible aparece en el HTML ni en los atributos', () => {
    const { container } = renderWithProviders(<ProTurnoCard turno={hostil as unknown as ProTurno} onAbrir={() => {}} />);
    const html = container.innerHTML;
    for (const secreto of ['5491155550000', '1155551234', 'secreto@x.com', 'wa-SECRETO', 'wa-OCULTO', '98765', '4321', '1234567', '55555', '66666']) {
      expect(html).not.toContain(secreto);
    }
    expect(html).toContain('Lucía');
  });

  it('no hay enlaces tel:/wa.me/mailto ni botones de editar, cancelar o borrar', () => {
    const { container } = renderWithProviders(<ProTurnoCard turno={hostil as unknown as ProTurno} onAbrir={() => {}} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(container.querySelector('a, [href]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/tel:|wa\.me|mailto:|sms:/i);
    // único botón: el de abrir la tarjeta
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('sin onAbrir no hay ningún botón', () => {
    renderWithProviders(<ProTurnoCard turno={turno()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ProTurnoCard — horario', () => {
  it('muestra la hora de inicio en serif 19, la duración y la mini fecha sin correr el día', () => {
    renderWithProviders(<ProTurnoCard turno={turno()} />);
    const hora = screen.getByText('09:30');
    expect(hora.style.fontFamily).not.toBe('');
    expect(hora.style.fontSize).toBe('19px');
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
    // La zona del dispositivo no puede correr el día: 17/10.
    expect(screen.getByText(/17\/10/)).toBeInTheDocument();
  });

  it('ya no muestra el rango de fin ni el aviso de día siguiente', () => {
    renderWithProviders(<ProTurnoCard turno={turno({ fecha_hora: '2026-10-17T23:30:00', duracion_total_minutos: 60 })} />);
    expect(screen.queryByText(/00:30/)).toBeNull();
    expect(screen.queryByText(/día siguiente/i)).toBeNull();
  });

  it('una fecha_hora inválida no rompe y muestra el aviso de sin hora', () => {
    renderWithProviders(<ProTurnoCard turno={turno({ fecha_hora: 'no-es-fecha' })} />);
    expect(screen.getByText('Sin hora')).toBeInTheDocument();
    expect(screen.getByText(/Lucía/)).toBeInTheDocument();
  });

  it('una duración inválida omite la duración y deja la hora', () => {
    renderWithProviders(<ProTurnoCard turno={turno({ duracion_total_minutos: -5 })} />);
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.queryByText(/min/)).toBeNull();
  });
});

describe('ProTurnoCard — cliente y contenido', () => {
  it('une nombre y apellido; con una sola parte muestra esa; sin ninguna muestra el neutro', () => {
    const { unmount } = renderWithProviders(<ProTurnoCard turno={turno()} />);
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    unmount();

    const b = renderWithProviders(<ProTurnoCard turno={turno({ cliente: { nombre: 'Lucía', apellido: null } })} />);
    expect(screen.getByText('Lucía')).toBeInTheDocument();
    b.unmount();

    const c = renderWithProviders(<ProTurnoCard turno={turno({ cliente: { nombre: null, apellido: 'Gómez' } })} />);
    expect(screen.getByText('Gómez')).toBeInTheDocument();
    c.unmount();

    renderWithProviders(<ProTurnoCard turno={turno({ cliente: { nombre: '  ', apellido: null } })} />);
    expect(screen.getByText('Sin nombre')).toBeInTheDocument();
  });

  it('lista los servicios con minWidth 0 para que una lista larga no rompa la fila', () => {
    const servicios = [1, 2, 3, 4, 5].map((i) => ({ id: i, nombre: `Servicio número ${i} con un nombre bastante largo` }));
    renderWithProviders(<ProTurnoCard turno={turno({ servicios })} />);
    const el = screen.getByText(/Servicio número 1/);
    expect(el).toBeInTheDocument();
    expect(screen.getByText(/Servicio número 5/)).toBeInTheDocument();
    expect(el.style.minWidth).toMatch(/^0(px)?$/);
  });

  it('muestra la promo con su rótulo solo si existe', () => {
    const { unmount } = renderWithProviders(<ProTurnoCard turno={turno({ promo: { nombre: 'Pack manos y pies' } })} />);
    expect(screen.getByText('Promo')).toBeInTheDocument();
    expect(screen.getByText('Pack manos y pies')).toBeInTheDocument();
    unmount();

    renderWithProviders(<ProTurnoCard turno={turno()} />);
    expect(screen.queryByText('Promo')).toBeNull();
  });
});

describe('ProTurnoCard — notas', () => {
  it('muestra el indicador solo con notas no vacías (recortadas)', () => {
    const { unmount } = renderWithProviders(<ProTurnoCard turno={turno({ notas: 'Traer diseño' })} />);
    expect(screen.getByRole('img', { name: 'Tiene una nota' })).toBeInTheDocument();
    expect(screen.getByText('Traer diseño')).toBeInTheDocument();
    unmount();

    const b = renderWithProviders(<ProTurnoCard turno={turno({ notas: '   \n ' })} />);
    expect(screen.queryByRole('img', { name: 'Tiene una nota' })).toBeNull();
    b.unmount();

    renderWithProviders(<ProTurnoCard turno={turno({ notas: null })} />);
    expect(screen.queryByRole('img', { name: 'Tiene una nota' })).toBeNull();
  });

  it('renderiza HTML, markdown y URLs como texto literal, sin autolink ni elementos', () => {
    const notas = '<script>alert(1)</script> <img src=x onerror=alert(2)> **negrita** [x](http://evil.test) https://evil.test/a';
    const { container } = renderWithProviders(<ProTurnoCard turno={turno({ notas })} />);
    const nota = screen.getByText((_, el) => el?.getAttribute('data-nota') === 'true');
    expect(nota.textContent).toBe(notas);
    expect(container.querySelector('script, img, strong, em')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(nota.style.whiteSpace).toBe('pre-wrap');
    expect(nota.getAttribute('dir')).toBe('auto');
  });

  it('el código fuente no usa dangerouslySetInnerHTML ni router', () => {
    const src = readFileSync(join(__dirname, 'ProTurnoCard.tsx'), 'utf8');
    expect(src).not.toMatch(/dangerouslySetInnerHTML|innerHTML|next\/navigation|router\./);
  });
});

describe('ProTurnoCard — estado y apertura', () => {
  it('confirmado y desconocido no llevan píldora; en curso y completado sí', () => {
    const casos: Array<[string, string | null]> = [
      ['confirmado', null],
      ['cancelado', null],
      ['en_curso', 'En curso'],
      ['completado', 'Completado'],
    ];
    for (const [estado, rotulo] of casos) {
      const r = renderWithProviders(<ProTurnoCard turno={turno({ estado_visual: estado as ProTurno['estado_visual'] })} />);
      for (const otro of ['En curso', 'Completado', 'Confirmado', 'Sin estado']) {
        if (otro === rotulo) expect(screen.getByText(otro)).toBeInTheDocument();
        else expect(screen.queryByText(otro)).toBeNull();
      }
      r.unmount();
    }
  });

  it('completado va sobre el fondo sutil; en curso no', () => {
    const c = renderWithProviders(<ProTurnoCard turno={turno({ estado_visual: 'completado' })} onAbrir={() => {}} />);
    expect(screen.getByRole('button').style.backgroundColor).toContain('--ag-surface-2');
    c.unmount();
    renderWithProviders(<ProTurnoCard turno={turno({ estado_visual: 'en_curso' })} onAbrir={() => {}} />);
    expect(screen.getByRole('button').style.backgroundColor).not.toContain('--ag-surface-2');
  });

  it('onAbrir recibe el id al tocar, y el control mide al menos 44px', () => {
    const onAbrir = vi.fn();
    renderWithProviders(<ProTurnoCard turno={turno({ id: 41 })} onAbrir={onAbrir} />);
    const boton = screen.getByRole('button');
    expect(boton.style.minHeight).toBe('44px');
    expect(boton).toHaveAccessibleName(/Lucía Gómez/);
    fireEvent.click(boton);
    expect(onAbrir).toHaveBeenCalledWith(41);
  });
});

describe('ProTurnoCard — profesional', () => {
  it('muestra "con {nombre}" con iniciales si no hay foto', () => {
    renderWithProviders(<ProTurnoCard turno={turno()} profesional={{ nombre: 'Ana', apellido: 'Pérez', avatar_url: null }} />);
    expect(screen.getByText('con Ana')).toBeInTheDocument();
    expect(screen.getByText('AP')).toBeInTheDocument();
  });

  it('con foto usa la imagen decorativa', () => {
    const { container } = renderWithProviders(
      <ProTurnoCard turno={turno()} profesional={{ nombre: 'Ana', apellido: null, avatar_url: 'https://cdn.test/a.jpg' }} />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/a.jpg');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('sin el dato no se dibuja la línea', () => {
    renderWithProviders(<ProTurnoCard turno={turno()} />);
    expect(screen.queryByText(/^con /)).toBeNull();
  });
});

describe('ProTurnoCard — promo', () => {
  const promo = turno({ promo: { nombre: 'Pack manos y pies' }, servicios: [{ id: 1, nombre: 'Manos' }, { id: 2, nombre: 'Pies' }] });

  it('cabecera con cliente, píldora y promo en cursiva, y un solo paso', () => {
    renderWithProviders(<ProTurnoCard turno={promo} profesional={{ nombre: 'Ana', apellido: null, avatar_url: null }} onAbrir={() => {}} />);
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    expect(screen.getByText('Promo')).toBeInTheDocument();
    expect(screen.getByText('Pack manos y pies').style.fontStyle).toBe('italic');
    expect(screen.getByText('09:30').style.fontSize).toBe('17px');
    expect(screen.getByText('Manos + Pies')).toBeInTheDocument();
    expect(screen.getByText('con Ana')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('abre el turno y mantiene el nombre accesible', () => {
    const onAbrir = vi.fn();
    renderWithProviders(<ProTurnoCard turno={{ ...promo, id: 9 }} onAbrir={onAbrir} />);
    const boton = screen.getByRole('button');
    expect(boton.style.minHeight).toBe('44px');
    expect(boton).toHaveAccessibleName(/Lucía Gómez/);
    fireEvent.click(boton);
    expect(onAbrir).toHaveBeenCalledWith(9);
  });
});
