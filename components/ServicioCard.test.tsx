import { describe, expect, it, vi } from 'vitest';
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
