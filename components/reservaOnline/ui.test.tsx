import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/render';
import { Avatar, PasoHeader } from './ui';

describe('PasoHeader', () => {
  it('muestra titulo serif, subtitulo y el progreso N/5 accesible', () => {
    renderWithProviders(<PasoHeader titulo="¿Cuándo venís?" subtitulo="Tu turno dura 2 h." paso={2} onVolver={() => {}} />);
    expect(screen.getByRole('heading', { name: '¿Cuándo venís?' })).toBeInTheDocument();
    expect(screen.getByText('Tu turno dura 2 h.')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Paso 2 de 5' });
    expect(barra).toHaveAttribute('aria-valuenow', '2');
    expect(barra).toHaveAttribute('aria-valuemax', '5');
  });

  it('el boton redondo de volver llama a onVolver', async () => {
    const onVolver = vi.fn();
    renderWithProviders(<PasoHeader titulo="x" paso={1} onVolver={onVolver} />);
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onVolver).toHaveBeenCalled();
  });

  it('sin subtitulo no renderiza texto extra', () => {
    renderWithProviders(<PasoHeader titulo="x" paso={1} />);
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
  });
});

describe('Avatar', () => {
  it('muestra la inicial en mayuscula del nombre', () => {
    renderWithProviders(<Avatar nombre="gabriela" />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });
  it('acepta contenido propio (ej. la estrella de "Cualquiera")', () => {
    renderWithProviders(<Avatar nombre="Cualquiera">★</Avatar>);
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('con fotoUrl muestra la foto real en vez de la inicial', () => {
    renderWithProviders(<Avatar nombre="Gabriela" fotoUrl="https://cdn.test/gabriela.jpg" />);
    expect(document.querySelector('img[src="https://cdn.test/gabriela.jpg"]')).not.toBeNull();
    expect(screen.queryByText('G')).toBeNull();
  });

  it('sin fotoUrl (null) sigue mostrando la inicial', () => {
    renderWithProviders(<Avatar nombre="Gabriela" fotoUrl={null} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });
});
