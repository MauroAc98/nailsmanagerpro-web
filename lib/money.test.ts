import { afterEach, describe, expect, it } from 'vitest';
import { useLocaleStore } from '@/store/useLocaleStore';
import { formatMonto } from './money';

afterEach(() => useLocaleStore.setState({ locale: 'es' }));

// Con el locale 'es' a secas, Intl no agrupa los números de 4 dígitos
// ("5000,00" pero "12.500,00"): el separador de miles aparecía recién desde
// 10.000, y los montos de la app se veían inconsistentes entre sí.
describe('formatMonto', () => {
  it('agrupa los miles desde 1.000 con punto y usa coma decimal (es)', () => {
    useLocaleStore.setState({ locale: 'es' });
    expect(formatMonto(5000)).toBe('5.000,00');
    expect(formatMonto(999)).toBe('999,00');
    expect(formatMonto(12500.5)).toBe('12.500,50');
    expect(formatMonto(1234567)).toBe('1.234.567,00');
    expect(formatMonto(0)).toBe('0,00');
  });

  it('mismo formato en portugués (pt-BR)', () => {
    useLocaleStore.setState({ locale: 'pt-BR' });
    expect(formatMonto(5000)).toBe('5.000,00');
    expect(formatMonto(12500.5)).toBe('12.500,50');
  });

  it('siempre dos decimales', () => {
    expect(formatMonto(1500)).toBe('1.500,00');
    expect(formatMonto(1500.5)).toBe('1.500,50');
  });
});
