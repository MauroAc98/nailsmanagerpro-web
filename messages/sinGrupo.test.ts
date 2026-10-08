import { describe, expect, it } from 'vitest';
import { es, loadMessages } from '@/messages';

// "Grupo" es el nombre interno de los turnos de una promo (o de varios servicios agendados
// juntos). En pantalla se les dice "turnos" ("Todos los turnos", "Seña de todos los turnos"):
// ningún texto de la agenda ni de las hojas comunes dice "grupo".
const textos = (obj: unknown, ruta = ''): [string, string][] =>
  typeof obj === 'string'
    ? [[ruta, obj]]
    : obj && typeof obj === 'object'
      ? Object.entries(obj).flatMap(([k, v]) => textos(v, ruta ? `${ruta}.${k}` : k))
      : [];

const conGrupo = (catalogo: { agenda?: unknown; common?: unknown }) =>
  textos({ agenda: catalogo.agenda, common: catalogo.common })
    .filter(([, texto]) => /\bgrupo\b/i.test(texto))
    .map(([ruta]) => ruta);

describe('textos visibles de la agenda', () => {
  it('en español ninguno dice "grupo"', () => {
    expect(conGrupo(es as never)).toEqual([]);
  });

  it('en portugués ninguno dice "grupo" (se carga el catálogo real)', async () => {
    const pt = await loadMessages('pt-BR');

    expect(textos(pt).length).toBeGreaterThan(500);
    expect(conGrupo(pt as never)).toEqual([]);
  });
});
