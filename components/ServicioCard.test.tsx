import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import ServicioCard from './ServicioCard';
import type { Servicio } from '@/services/servicioService';

function buildServicio(overrides: Partial<Servicio> = {}): Servicio {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Manicura',
    duracion_minutos: 30,
    precio: '100',
    activo: true,
    es_promo: false,
    orden: 0,
    categoria_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

// Mismo affordance que SwipeableTurnoCard (Change 4, agenda) — pedido
// explícito del usuario de replicar la tira visible del panel de eliminar
// en todas las cards con swipe-to-delete, no solo en Agenda.
describe('ServicioCard — swipe-to-delete resting peek', () => {
  it('rests with the delete panel peeking (-8px), not fully closed', () => {
    const { container } = renderWithProviders(
      <ServicioCard servicio={buildServicio()} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding).toBeTruthy();
    expect(sliding.style.transform).toBe('translateX(-8px)');
  });
  // El peek desplaza la capa 8px a la izquierda y el borde de la card recorta
  // esos 8px: sin compensar, el contenido perdía margen izquierdo.
  it('compensa el desplazamiento del peek con padding izquierdo, para no recortar el contenido', () => {
    const { container } = renderWithProviders(
      <ServicioCard servicio={buildServicio()} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const sliding = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(sliding.style.paddingLeft).toBe('24px');
  });
});

describe('ServicioCard — jerarquía visual', () => {
  it('muestra el precio como dato principal, sin decimales cuando es entero', () => {
    const { getByText, queryByText } = renderWithProviders(
      <ServicioCard servicio={buildServicio({ precio: '18000' })} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(getByText('$18.000')).toBeInTheDocument();
    expect(queryByText(/,00/)).toBeNull();
  });

  it('un servicio inactivo lleva la etiqueta PAUSADO', () => {
    const { getByText } = renderWithProviders(
      <ServicioCard servicio={buildServicio({ activo: false })} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(getByText('PAUSADO')).toBeInTheDocument();
  });

  it('un servicio activo no lleva etiqueta PAUSADO', () => {
    const { queryByText } = renderWithProviders(
      <ServicioCard servicio={buildServicio()} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(queryByText('PAUSADO')).toBeNull();
  });
});

// El nombre manda: va en su propia fila a todo el ancho; etiqueta, duración,
// precio y toggle viven en una fila de abajo y ya no le quitan ancho.
describe('ServicioCard — filas', () => {
  it('etiqueta PROMO, duración y precio comparten la fila de abajo; el nombre no está en esa fila', () => {
    renderWithProviders(
      <ServicioCard servicio={buildServicio({ nombre: 'Combo', es_promo: true })} showPromoBadge onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const filaMeta = screen.getByText('PROMO').parentElement!.parentElement!;
    expect(filaMeta).toHaveTextContent('30 min');
    expect(filaMeta).toHaveTextContent('$100');
    expect(filaMeta).not.toHaveTextContent('Combo');
  });

  it('el toggle está en la fila de abajo, junto al precio', () => {
    renderWithProviders(
      <ServicioCard servicio={buildServicio()} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    const filaMeta = screen.getByText('$100').parentElement!.parentElement!;
    expect(filaMeta.querySelector('[role="switch"], button')).not.toBeNull();
  });
});

// Un nombre largo se parte en hasta 2 lineas; si aun asi se corta, tocar el
// nombre abre un popover con el texto completo (no hay hover en la PWA).
describe('ServicioCard — nombre largo', () => {
  const NOMBRE_LARGO = 'Esmaltado semipermanente con diseño a mano alzada y pedrería';

  afterEach(() => {
    for (const p of ['scrollWidth', 'clientWidth', 'scrollHeight', 'clientHeight']) {
      delete (HTMLParagraphElement.prototype as unknown as Record<string, unknown>)[p];
    }
  });
  const medidas = (m: Record<string, number>) => {
    for (const [k, v] of Object.entries(m)) {
      Object.defineProperty(HTMLParagraphElement.prototype, k, { configurable: true, get: () => v });
    }
  };

  it('el nombre se muestra en hasta 2 lineas', () => {
    medidas({ scrollWidth: 100, clientWidth: 120, scrollHeight: 20, clientHeight: 20 });
    renderWithProviders(
      <ServicioCard servicio={buildServicio({ nombre: NOMBRE_LARGO })} onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText(NOMBRE_LARGO).style.webkitLineClamp).toBe('2');
  });

  it('si entra completo, tocar el nombre abre la edicion', () => {
    medidas({ scrollWidth: 100, clientWidth: 120, scrollHeight: 20, clientHeight: 20 });
    const onEdit = vi.fn();
    renderWithProviders(
      <ServicioCard servicio={buildServicio({ nombre: NOMBRE_LARGO })} onEdit={onEdit} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(NOMBRE_LARGO));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('si queda recortado, tocar el nombre muestra el nombre completo y NO abre la edicion', () => {
    medidas({ scrollWidth: 120, clientWidth: 120, scrollHeight: 60, clientHeight: 40 });
    const onEdit = vi.fn();
    renderWithProviders(
      <ServicioCard servicio={buildServicio({ nombre: NOMBRE_LARGO })} onEdit={onEdit} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(NOMBRE_LARGO));
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent(NOMBRE_LARGO);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
