import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { AvisoTruncado } from './AvisoTruncado';

describe('AvisoTruncado', () => {
  it('truncado: avisa que hay más y sugiere acotar', () => {
    renderWithProviders(<AvisoTruncado truncado />);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('primeros 500 turnos');
    expect(aviso).toHaveTextContent('Acota el rango de fechas');
  });

  it('no truncado: no muestra nada', () => {
    renderWithProviders(<AvisoTruncado truncado={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
