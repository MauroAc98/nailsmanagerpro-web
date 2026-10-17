'use client';

import { useEffect, useState } from 'react';
import { proService } from '@/services/proService';
import { cacheTurnosRango } from '@/lib/pro/caches';
import { rangoPermitido } from '@/lib/pro/fechaHora';
import type { ProListaTurnos } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useProRecurso, type ProRecurso } from '@/hooks/pro/useProRecurso';

export interface ParamsRango {
  desde: string;
  hasta: string;
  buscar: string;
  servicioId: number | null;
}

export type MotivoInvalido = 'rango' | 'buscar';

export interface ProRango extends ProRecurso<ProListaTurnos> {
  // Por qué no se está pidiendo (la pantalla muestra el aviso en línea).
  invalido: MotivoInvalido | null;
}

const DEBOUNCE_MS = 300;
const BUSCAR_MAX_CARACTERES = 60;
const BUSCAR_MAX_PALABRAS = 5;

const buscarValido = (buscar: string): boolean =>
  buscar.length <= BUSCAR_MAX_CARACTERES && buscar.split(/\s+/).filter(Boolean).length <= BUSCAR_MAX_PALABRAS;

// Turnos de un rango con filtros (AG-4). Valida ANTES de pedir: un rango o un
// texto inválido no genera ningún request. `buscar` se recorta y se envía con
// debounce de 300 ms; el servicio va por id.
export function useProTurnosRango({ desde, hasta, buscar, servicioId }: ParamsRango): ProRango {
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const texto = buscar.trim();
  const [textoPedido, setTextoPedido] = useState(texto);

  useEffect(() => {
    const t = setTimeout(() => setTextoPedido(texto), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [texto]);

  const invalido: MotivoInvalido | null = !rangoPermitido(desde, hasta) ? 'rango' : !buscarValido(texto) ? 'buscar' : null;
  // Se pide con el texto ya debounceado, y solo si también ese es válido.
  const puedePedir = invalido === null && vinculoId !== null && buscarValido(textoPedido);
  const clave = puedePedir ? `${vinculoId}:rango:${desde}:${hasta}:${servicioId ?? ''}:${textoPedido}` : null;

  const recurso = useProRecurso(
    clave,
    (signal) =>
      proService.turnos(
        vinculoId as number,
        { desde, hasta, ...(textoPedido ? { buscar: textoPedido } : {}), ...(servicioId !== null ? { servicio_id: servicioId } : {}) },
        signal,
      ),
    cacheTurnosRango,
  );
  return { ...recurso, invalido };
}
