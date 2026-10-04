import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { IdeaDelTurno } from './IdeaDelTurno';

const LARGA = 'Tengo las uñas muy cortas porque me las muerdo. Me gustaría la forma cuadrada redondeada y esmaltado semipermanente en rosa viejo, con piedritas pequeñas solo en dos dedos. Tengo alergia al acrílico.';

describe('IdeaDelTurno', () => {
  it('muestra el título y la nota completa cuando es corta, sin botón', () => {
    renderWithProviders(<IdeaDelTurno notas="Algo minimalista" origenWeb />);
    expect(screen.getByText('Idea para el turno')).toBeInTheDocument();
    expect(screen.getByText('Algo minimalista')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('aclara que se escribió al reservar online solo en turnos web', () => {
    const { rerender } = renderWithProviders(<IdeaDelTurno notas="Algo" origenWeb />);
    expect(screen.getByText('Escrita al reservar online')).toBeInTheDocument();
    rerender(<IdeaDelTurno notas="Algo" origenWeb={false} />);
    expect(screen.queryByText('Escrita al reservar online')).toBeNull();
  });

  it('con una nota larga ofrece "Ver todo" y alterna con "Ver menos"', async () => {
    renderWithProviders(<IdeaDelTurno notas={LARGA} origenWeb />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver todo' }));
    expect(screen.getByRole('button', { name: 'Ver menos' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.getByRole('button', { name: 'Ver todo' })).toBeInTheDocument();
  });

  it('no dibuja nada sin nota o con una nota en blanco', () => {
    const { container, rerender } = renderWithProviders(<IdeaDelTurno notas={null} origenWeb />);
    expect(container).toBeEmptyDOMElement();
    rerender(<IdeaDelTurno notas="   " origenWeb />);
    expect(container).toBeEmptyDOMElement();
  });

  it('respeta los saltos de línea de la nota', () => {
    renderWithProviders(<IdeaDelTurno notas={'Línea uno\nLínea dos'} origenWeb />);
    const p = screen.getByText(/Línea uno/);
    expect(getComputedStyle(p).whiteSpace).toBe('pre-wrap');
  });
});
