import { useEffect, useMemo, useState } from 'react';
import { hornearFotoEncabezado } from '@/lib/historia/captura';
import { elegirFotoEncabezado } from '@/lib/historia/fotoEncabezado';

// Foto del recuadro del encabezado de las historias (turnos y precios): el
// avatar de la profesional efectiva si tiene, si no el logo del negocio, si no
// null. Compartido para que las dos historias elijan y preparen la foto igual.
//
// La URL es del backend, servida sin Access-Control-Allow-Origin: html-to-image
// no puede embeberla al capturar. Se reescribe al proxy same-origin
// (app/api/historia-fondo, que pese al nombre solo reescribe el origin). El
// proxy resuelve el CORS, pero Safari además necesita que la foto ya viaje
// embebida (data URL) y que no haya `filter` CSS en el árbol capturado
// (reportado real en prod 2026-10-01: la historia entera salía negra). Por eso
// se hornea con Canvas 2D (hornearFotoEncabezado), a color.
//
// Reset sincrónico durante el render (patrón oficial de React, sin setState
// dentro de un efecto): arranca con la URL proxiada y el efecto la reemplaza
// por la imagen embebida apenas está lista. Si falla (offline, proxy caído) se
// queda con la URL proxiada: mejor eso que ocultar la foto.
export function useFotoEncabezado(
  profesionales: { id: number; avatar_url?: string | null }[],
  profesionalEfectivaId: number | null,
  logoNegocioCrudo: string | null,
): string | null {
  const urlCruda = elegirFotoEncabezado(profesionales, profesionalEfectivaId, logoNegocioCrudo);
  const urlProxiada = useMemo(
    () => (urlCruda ? `/api/historia-fondo?url=${encodeURIComponent(urlCruda)}` : null),
    [urlCruda]
  );
  const [proxiadaSincronizada, setProxiadaSincronizada] = useState(urlProxiada);
  const [url, setUrl] = useState<string | null>(urlProxiada);
  if (proxiadaSincronizada !== urlProxiada) {
    setProxiadaSincronizada(urlProxiada);
    setUrl(urlProxiada);
  }
  useEffect(() => {
    if (!urlProxiada) return;
    let cancelado = false;
    hornearFotoEncabezado(urlProxiada)
      .then(dataUrl => { if (!cancelado) setUrl(dataUrl); })
      .catch(() => {
        // ya quedó en urlProxiada por el reset de arriba, nada que hacer
      });
    return () => { cancelado = true; };
  }, [urlProxiada]);
  return url;
}
