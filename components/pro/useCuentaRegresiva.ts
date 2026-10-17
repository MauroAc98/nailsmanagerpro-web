'use client';

import { useEffect, useState } from 'react';
import type { ProError } from '@/lib/pro/errores';

// Segundos que faltan para poder reintentar tras un 429 con espera conocida;
// null si el error no es de ese tipo (o no trae segundos). Se calcula contra una
// hora límite fija, no restando de a uno, así un intervalo demorado (pestaña en
// segundo plano) no estira la espera. El intervalo se limpia al desmontar y al
// llegar a cero.
export function useCuentaRegresiva(error: ProError | null): number | null {
  const segundos = error?.kind === 'rateLimited' ? error.retryAfterSec : null;
  const [restantes, setRestantes] = useState<number | null>(segundos);
  const [origen, setOrigen] = useState<ProError | null>(error);

  // Error nuevo: se reinicia la cuenta durante el render (sin efecto extra).
  if (origen !== error) {
    setOrigen(error);
    setRestantes(segundos);
  }

  useEffect(() => {
    if (segundos === null) return;
    const limite = Date.now() + segundos * 1000;
    const id = setInterval(() => {
      const faltan = Math.max(0, Math.ceil((limite - Date.now()) / 1000));
      setRestantes(faltan);
      if (faltan === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [error, segundos]);

  return segundos === null ? null : restantes;
}
