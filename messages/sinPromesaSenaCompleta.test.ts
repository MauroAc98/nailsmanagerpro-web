import { describe, expect, it } from 'vitest';
import { es, loadMessages } from '@/messages';

// La sugerencia de precio de la seña busca que la profesional NO PIERDA plata por la comisión
// de Mercado Pago. Ya no promete que "le llegue la seña completa" (esa era la regla anterior, y
// con la seña redondeada ni siquiera es verdad): ningún texto de seña lo dice.
const textos = (obj: unknown, ruta = ''): [string, string][] =>
  typeof obj === 'string'
    ? [[ruta, obj]]
    : obj && typeof obj === 'object'
      ? Object.entries(obj).flatMap(([k, v]) => textos(v, ruta ? `${ruta}.${k}` : k))
      : [];

const PROMESA_ES = /recibirla completa|recibirlo completo|te lleguen completos|te lleguen los \$[\d.]+ completos/i;
const PROMESA_PT = /recebê-lo por completo|recebe-lo por completo|cheguem completos|chegue completo/i;

describe('textos de la seña', () => {
  it('en español ninguno promete que la seña llega completa', () => {
    const conPromesa = textos(es).filter(([, texto]) => PROMESA_ES.test(texto)).map(([ruta]) => ruta);
    expect(conPromesa).toEqual([]);
  });

  it('en portugués ninguno promete que o sinal chega completo (se carga el catálogo real)', async () => {
    const pt = await loadMessages('pt-BR');

    expect(textos(pt).length).toBeGreaterThan(500);
    const conPromesa = textos(pt).filter(([, texto]) => PROMESA_PT.test(texto)).map(([ruta]) => ruta);
    expect(conPromesa).toEqual([]);
  });

  it('el aviso al guardar la seña dice que ajustar el precio es opcional', () => {
    const aviso = (es as unknown as { perfil: { PerfilPage: { senaSavedCommission: string } } })
      .perfil.PerfilPage.senaSavedCommission;

    expect(aviso).toBe(
      'Seña guardada. Mercado Pago se queda una parte de cada seña. Si querés, podés ajustar el precio de tus servicios para cubrirla.',
    );
  });
});
