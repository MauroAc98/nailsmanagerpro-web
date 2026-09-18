import { describe, expect, it } from 'vitest';
import { formatoPrecioTarjeta } from './formatoPrecioTarjeta';

// La tarjeta de "Historia de precios" es una imagen que se comparte: siempre
// es-AR (independiente del idioma de la app), sin decimales, y con el mismo
// estilo de signo que el resto de la app: "$1.500", sin espacio.
describe('formatoPrecioTarjeta', () => {
  it('usa punto de miles y no lleva decimales', () => {
    expect(formatoPrecioTarjeta('1500')).toBe('$1.500');
    expect(formatoPrecioTarjeta('1500.00')).toBe('$1.500');
    expect(formatoPrecioTarjeta('1234567')).toBe('$1.234.567');
  });

  it('redondea si el precio trae centavos', () => {
    expect(formatoPrecioTarjeta('1500.60')).toBe('$1.501');
  });

  it('sin signo: guion cuando el servicio no tiene precio', () => {
    expect(formatoPrecioTarjeta(null)).toBe('-');
    expect(formatoPrecioTarjeta('')).toBe('-');
  });
});
