import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFotoEncabezado } from './useFotoEncabezado';

const hornear = vi.fn();
vi.mock('@/lib/historia/captura', () => ({
  hornearFotoEncabezado: (url: string) => hornear(url),
}));

const prox = (u: string) => `/api/historia-fondo?url=${encodeURIComponent(u)}`;
const profes = [
  { id: 1, avatar_url: 'https://cdn/ana.jpg' },
  { id: 2, avatar_url: null },
];

beforeEach(() => {
  hornear.mockReset();
  hornear.mockResolvedValue('data:image/png;base64,HORNEADA');
});

describe('useFotoEncabezado', () => {
  it('sin avatar ni logo no hay foto', () => {
    const { result } = renderHook(() => useFotoEncabezado([{ id: 2 }], 2, null));
    expect(result.current).toBeNull();
    expect(hornear).not.toHaveBeenCalled();
  });

  it('prefiere el avatar de la profesional efectiva: arranca proxiada y se reemplaza por la horneada', async () => {
    const { result } = renderHook(() => useFotoEncabezado(profes, 1, 'https://cdn/logo.png'));
    expect(result.current).toBe(prox('https://cdn/ana.jpg'));
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,HORNEADA'));
    expect(hornear).toHaveBeenCalledWith(prox('https://cdn/ana.jpg'));
  });

  it('sin avatar cae al logo del negocio', async () => {
    const { result } = renderHook(() => useFotoEncabezado(profes, 2, 'https://cdn/logo.png'));
    expect(result.current).toBe(prox('https://cdn/logo.png'));
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,HORNEADA'));
  });

  it('si hornear falla se queda con la URL proxiada', async () => {
    hornear.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useFotoEncabezado(profes, 2, 'https://cdn/logo.png'));
    await waitFor(() => expect(hornear).toHaveBeenCalled());
    expect(result.current).toBe(prox('https://cdn/logo.png'));
  });

  it('al cambiar de profesional vuelve a la URL proxiada nueva sincrónicamente', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFotoEncabezado(profes, id, 'https://cdn/logo.png'),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,HORNEADA'));
    hornear.mockReturnValue(new Promise(() => {}));
    rerender({ id: 2 });
    expect(result.current).toBe(prox('https://cdn/logo.png'));
  });
});
