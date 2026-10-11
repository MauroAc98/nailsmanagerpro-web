// Caché en memoria con tope: al pasarse del máximo descarta la clave menos
// usada. Sirve para mostrar al instante lo último visto de un filtro mientras
// se refresca de fondo (stale-while-revalidate).
//
// Cada entrada vence a los `vigenciaMs` (1 minuto por defecto): volver a una
// pantalla mucho después muestra el esqueleto de carga en vez de datos viejos.
export interface CacheLru<V> {
  get: (clave: string) => V | undefined;
  set: (clave: string, valor: V) => void;
  clear: () => void;
  size: () => number;
}

const VIGENCIA_POR_DEFECTO_MS = 60_000;

export function crearCacheLru<V>(max: number, vigenciaMs = VIGENCIA_POR_DEFECTO_MS): CacheLru<V> {
  const mapa = new Map<string, { valor: V; guardadoEn: number }>();
  const purgarVencidas = () => {
    const ahora = Date.now();
    for (const [clave, entrada] of mapa) {
      if (ahora - entrada.guardadoEn > vigenciaMs) mapa.delete(clave);
    }
  };
  return {
    get(clave) {
      purgarVencidas();
      const entrada = mapa.get(clave);
      if (!entrada) return undefined;
      mapa.delete(clave);
      mapa.set(clave, entrada); // la más reciente va al final
      return entrada.valor;
    },
    set(clave, valor) {
      mapa.delete(clave);
      mapa.set(clave, { valor, guardadoEn: Date.now() });
      if (mapa.size > max) mapa.delete(mapa.keys().next().value as string);
    },
    clear: () => mapa.clear(),
    size: () => {
      purgarVencidas();
      return mapa.size;
    },
  };
}
