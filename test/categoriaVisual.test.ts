import { describe, expect, it } from 'vitest';
import { categoriaSlot, categoriaVisual } from '@/lib/categoriaVisual';

// Icon shape varies by id (D1/D2); color is a CONSTANT single brand accent
// for every category (D3 — corrected after the user rejected a per-category
// hue palette as "un arcoiris"). These tests exist specifically to catch a
// regression back to that rejected hue palette — do not "fix" them to allow
// per-category color again.

describe('categoriaSlot', () => {
  it('siempre devuelve un slot entre 0 y 7 (invariante del largo de la paleta)', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 100, 999, -5];
    for (const id of ids) {
      const slot = categoriaSlot(id);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(7);
    }
  });

  it('8 ids consecutivos cubren los 8 slots exactamente una vez (stride-5 bijection)', () => {
    const slots = [1, 2, 3, 4, 5, 6, 7, 8].map(categoriaSlot);
    const uniqueSlots = new Set(slots);
    expect(uniqueSlots.size).toBe(8);
    expect([...uniqueSlots].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('categoriaVisual', () => {
  it('el mismo id siempre da la misma identidad (determinismo)', () => {
    const first = categoriaVisual(42);
    const second = categoriaVisual(42);
    expect(second.icon).toBe(first.icon);
    expect(second.tint).toBe(first.tint);
    expect(second.tintStrong).toBe(first.tintStrong);
  });

  it('categorías distintas tienen el mismo color pero pueden diferir en ícono', () => {
    const a = categoriaVisual(1);
    const b = categoriaVisual(2);
    // Color es constante para TODA categoría no-nula — nunca un hue por
    // categoría. Esta es la aserción que detecta la regresión al diseño
    // original de 8 hues (rechazado por el usuario).
    expect(a.tint).toBe(b.tint);
    expect(a.tintStrong).toBe(b.tintStrong);
    // Distintos ids (separados 1 slot vía stride-5) deben caer en slots
    // distintos, así que el ícono difiere.
    expect(a.icon).not.toBe(b.icon);
  });

  it('id null devuelve el fallback neutral, con su propio tono (no parte de la paleta por categoría)', () => {
    const neutral = categoriaVisual(null);
    const categorized = categoriaVisual(1);

    expect(neutral.icon).not.toBe(categorized.icon);
    // El neutral usa su propio tono distinto del acento de marca constante.
    expect(neutral.tint).not.toBe(categorized.tint);
    expect(neutral.tintStrong).not.toBe(categorized.tintStrong);
  });

  it('el color es idéntico incluso comparando varios ids no-nulos entre sí', () => {
    const tints = [1, 2, 3, 4, 5, 6, 7, 8].map(id => categoriaVisual(id).tint);
    const tintsStrong = [1, 2, 3, 4, 5, 6, 7, 8].map(id => categoriaVisual(id).tintStrong);

    expect(new Set(tints).size).toBe(1);
    expect(new Set(tintsStrong).size).toBe(1);
  });
});
