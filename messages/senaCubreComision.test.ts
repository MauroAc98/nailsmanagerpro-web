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

  // Lo que llega de más por el redondeo, y para qué se redondea, es UNA sola oración: la misma en el panel (porcentaje
  // y monto fijo) y en la tarjeta del servicio. El detalle de la tarjeta no la repite con otra nota.
  it('el extra del redondeo y su motivo se dicen con una sola frase en las tres pantallas (es y pt-BR)', async () => {
    const pt = await loadMessages('pt-BR');
    type Claves = { perfil: { SheetSenaYPagos: Record<string, string> }; configuracion: { SenaPreviewServicio: Record<string, string> } };
    const motivos = {
      es: 'porque redondeamos la seña hacia arriba para que al cliente le resulte fácil pagar el resto al terminar el servicio.',
      'pt-BR': 'porque arredondamos o sinal para cima para que seja fácil para o cliente pagar o restante ao terminar o serviço.',
    };
    for (const [idioma, m] of [['es', es as unknown as Claves], ['pt-BR', pt as unknown as Claves]] as const) {
      const textosExtra = [
        m.perfil.SheetSenaYPagos.exampleCoversExtra,
        m.perfil.SheetSenaYPagos.fixedRoundedNote,
        m.configuracion.SenaPreviewServicio.coveredNoteExtra,
      ];
      for (const t of textosExtra) {
        expect(t, idioma).toMatch(/\{extra\} [^,]+, /);
        expect(t, idioma).toContain(motivos[idioma]);
      }
      expect(m.perfil.SheetSenaYPagos, idioma).not.toHaveProperty('roundingReason');
      expect(m.configuracion.SenaPreviewServicio, idioma).not.toHaveProperty('detailRoundingNote');
    }
    expect(JSON.stringify(es)).not.toMatch(/Subimos y redondeamos|un poco más \(|te llega completo|lo que querías|pago en el local/i);
  });

  // El panel ya explica que la comisión está incluida: al guardar alcanza con el aviso corto de siempre.
  it('no hay un aviso largo especial al guardar la seña (ni en español ni en portugués)', async () => {
    const pt = await loadMessages('pt-BR');
    const paginaEs = (es as unknown as { perfil: { PerfilPage: Record<string, string> } }).perfil.PerfilPage;
    const paginaPt = (pt as unknown as { perfil: { PerfilPage: Record<string, string> } }).perfil.PerfilPage;

    expect(paginaEs).not.toHaveProperty('senaSavedCommission');
    expect(paginaPt).not.toHaveProperty('senaSavedCommission');
  });
});
