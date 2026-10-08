import { describe, expect, it } from 'vitest';
import { es, loadMessages } from '@/messages';

// "Combo" es un nombre interno. Al crear el servicio la persona ve "promoción", y
// un grupo de turnos puede venir de una promo o de varios servicios tildados en la
// reserva online: ningún texto visible lo llama "combo".
const textos = (obj: unknown, ruta = ''): [string, string][] =>
  typeof obj === 'string'
    ? [[ruta, obj]]
    : obj && typeof obj === 'object'
      ? Object.entries(obj).flatMap(([k, v]) => textos(v, ruta ? `${ruta}.${k}` : k))
      : [];

const conCombo = (catalogo: unknown) =>
  textos(catalogo).filter(([, texto]) => /\bcombo\b/i.test(texto)).map(([ruta]) => ruta);

describe('textos visibles', () => {
  it('en español ninguno dice "combo"', () => {
    expect(conCombo(es)).toEqual([]);
  });

  it('en portugués ninguno dice "combo" (se carga el catálogo real, no un objeto vacío)', async () => {
    const pt = await loadMessages('pt-BR');

    expect(textos(pt).length).toBeGreaterThan(500);
    expect(conCombo(pt)).toEqual([]);
  });
});
