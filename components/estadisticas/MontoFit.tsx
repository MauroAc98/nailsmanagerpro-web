'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  maxFontSize: number;
  minFontSize?: number;
  style?: CSSProperties;
}

// Un monto nunca se corta ni se oculta tras "…", por grande que sea: arranca
// en maxFontSize y baja de a 1px hasta entrar en el ancho de su contenedor
// (mínimo minFontSize). Si ni así entra, el número baja de renglón en lugar
// de recortarse. Ajusta el DOM directamente (sin estado) para no re-renderizar
// ni parpadear; se recalcula si cambia el texto o el ancho del contenedor.
export function MontoFit({ children, maxFontSize, minFontSize = 11, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const contenedor = el?.parentElement;
    if (!el || !contenedor) return;

    const ajustar = () => {
      el.style.whiteSpace = 'nowrap';
      el.style.overflowWrap = '';
      let size = maxFontSize;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > contenedor.clientWidth && size > minFontSize) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      if (el.scrollWidth > contenedor.clientWidth) {
        el.style.whiteSpace = 'normal';
        el.style.overflowWrap = 'anywhere';
      }
    };

    ajustar();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(ajustar);
    ro.observe(contenedor);
    return () => ro.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <span ref={ref} style={{ display: 'inline-block', maxWidth: '100%', ...style, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
