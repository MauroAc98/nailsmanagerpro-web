import { describe, expect, it } from 'vitest';
import { es, loadMessages } from '@/messages';

// La seña por porcentaje ya incluye el costo de Mercado Pago (la cubre el backend al calcularla), así
// que la app NO sugiere subir el precio de los servicios y el cliente no ve porcentajes que no
// cierran con lo que paga. Ningún texto vuelve a hablar de "precio sugerido" ni de ajustar precios.
const textos = (obj: unknown, ruta = ''): [string, string][] =>
  typeof obj === 'string'
    ? [[ruta, obj]]
    : obj && typeof obj === 'object'
      ? Object.entries(obj).flatMap(([k, v]) => textos(v, ruta ? `${ruta}.${k}` : k))
      : [];

const SUGERENCIA_ES = /precio sugerido|te sugerimos|subir el precio|ajustar el precio|cubrir esa comisión/i;
const SUGERENCIA_PT = /preço sugerido|sugerimos|subir o preço|ajustar o preço|ajustar o preço dos|cobrir essa comissão/i;

describe('textos de la seña', () => {
  it('en español ninguno sugiere ajustar el precio para cubrir la comisión', () => {
    const conSugerencia = textos(es).filter(([, texto]) => SUGERENCIA_ES.test(texto)).map(([ruta]) => ruta);
    expect(conSugerencia).toEqual([]);
  });

  it('en portugués ninguno sugiere ajustar el preço (se carga el catálogo real)', async () => {
    const pt = await loadMessages('pt-BR');

    expect(textos(pt).length).toBeGreaterThan(500);
    const conSugerencia = textos(pt).filter(([, texto]) => SUGERENCIA_PT.test(texto)).map(([ruta]) => ruta);
    expect(conSugerencia).toEqual([]);
  });

  it('el aviso al guardar la seña dice que ya incluye lo que cobra Mercado Pago', () => {
    const aviso = (es as unknown as { perfil: { PerfilPage: { senaSavedCommission: string } } })
      .perfil.PerfilPage.senaSavedCommission;

    expect(aviso).toBe(
      'Seña guardada. Lo que paga el cliente ya incluye lo que cobra Mercado Pago, así que a vos te llega completo el porcentaje.',
    );
  });
});
