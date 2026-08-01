import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';
import { fetchAsDataUrl, prepararImagenesParaCaptura } from '@/lib/historia/captura';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { profesionalJefa, LayoutId, EstiloId } from '@/services/profesionalService';

const DEFAULT_LAYOUT: LayoutId = 'single';
const DEFAULT_ESTILO: EstiloId = 'classic';
const FILENAME = 'historia-precios.png';

const proxiedUrl = (url: string) => `/api/historia-fondo?url=${encodeURIComponent(url)}`;

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
// useHistoriaPrecios — mirrors useGenerarHistoria's pipeline (proactive
// data: resolution, capturar() via prepararImagenesParaCaptura + double
// toBlob() warm-up, share/download UX) generalized from a single fondoUri
// to N price-story photos. See design decision D2 (sdd/dynamic-price-story)
// for why the resolution effect exists and D3 for why this hook never
// passes a `scale`/`mode` prop into HistoriaPreciosCanvas — that stays the
// screen's job (a CSS-transform wrapper around the ref'd node), not the
// hook's.
export function useHistoriaPrecios() {
  // ─────────────────────────────────────────────
  // Professional context — no professional selector for the price story
  // (unlike agenda-historia's multi-agenda picker): layout/estilo/fotos are
  // scoped to a single "effective" professional, same jefa-default fallback
  // used everywhere else in the app when there's no explicit selection.
  // ─────────────────────────────────────────────
  const { profesionales } = useProfesionalStore();
  const effectiveProfesionalId = useMemo(() => profesionalJefa(profesionales)?.id ?? null, [profesionales]);
  const profesionalActual = useMemo(
    () => profesionales.find(p => p.id === effectiveProfesionalId) ?? null,
    [profesionales, effectiveProfesionalId]
  );

  // Servicios activos — el price story no distingue es_promo visualmente
  // (spec: "Generated image reflects live service data", sin tratamiento
  // especial en v1), así que alcanza con el mismo filtro `activo` que ya
  // usa el resto de la app.
  const { servicios } = useServiciosStore();
  const serviciosActivos = useMemo(() => servicios.filter(s => s.activo), [servicios]);

  // ─────────────────────────────────────────────
  // Layout / estilo selection — puramente local a esta sesión. Ningún task
  // de las 6 fases persiste esta selección de vuelta al backend (D1 define
  // el contrato PUT pero ninguna fase lo llama todavía) — queda como ítem
  // abierto, ver apply-progress.
  // ─────────────────────────────────────────────
  const [layoutId, setLayoutId] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [estiloId, setEstiloId] = useState<EstiloId>(DEFAULT_ESTILO);
  const handleLayoutChange = useCallback((id: LayoutId) => setLayoutId(id), []);
  const handleEstiloChange = useCallback((id: EstiloId) => setEstiloId(id), []);

  // ─────────────────────────────────────────────
  // Fotos — fuente de verdad cruda (FotoHistoria[], para GestorFotos) +
  // proyección resuelta a data: URLs (string[], para HistoriaPreciosCanvas/
  // SelectorPlantilla). fotosOrdenadas fija el orden que layouts/picker
  // asumen por índice (fotos[0], fotos[1]...), igual que GestorFotos ordena
  // internamente por `orden`.
  // ─────────────────────────────────────────────
  const fotosOrdenadas = useMemo(
    () => [...(profesionalActual?.historia_precios_fotos ?? [])].sort((a, b) => a.orden - b.orden),
    [profesionalActual]
  );

  const [dataUrlsPorFoto, setDataUrlsPorFoto] = useState<Record<number, string>>({});

  // Resolver cada foto a data: URL proactivamente — mismo patrón que el
  // efecto de useGenerarHistoria keyed en proxiedFondoFijoGuardado,
  // extendido a N fotos en vez de una sola. Corre en mount y cada vez que
  // cambia el set de fotos (subida/borrado vía GestorFotos), así para
  // cuando el usuario elige plantilla o captura, cada <img> que el canvas
  // renderiza ya es data: — no compite con la red (ver D2).
  useEffect(() => {
    let cancelled = false;

    fotosOrdenadas.forEach(foto => {
      if (dataUrlsPorFoto[foto.id]) return; // ya resuelta

      fetchAsDataUrl(proxiedUrl(foto.url))
        .then(dataUrl => {
          if (cancelled) return;
          setDataUrlsPorFoto(prev => (prev[foto.id] ? prev : { ...prev, [foto.id]: dataUrl }));
        })
        .catch(() => {
          // fetch falló (offline, proxy caído) — capturar()'s
          // prepararImagenesParaCaptura reintenta como último recurso.
        });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosOrdenadas]);

  // fotosUrls — MISMA referencia de array reusada por todas las 9
  // miniaturas del picker y por el canvas principal (ver SelectorPlantilla:
  // "one fetch per photo total, not per thumbnail"). Solo cambia cuando
  // cambia el set de fotos o se resuelve una nueva data: URL.
  const fotosUrls = useMemo(
    () => fotosOrdenadas.map(foto => dataUrlsPorFoto[foto.id] ?? proxiedUrl(foto.url)),
    [fotosOrdenadas, dataUrlsPorFoto]
  );

  const puedeCapturar = fotosOrdenadas.length > 0;

  // ─────────────────────────────────────────────
  // Captura — delega en prepararImagenesParaCaptura (lib/historia/captura.ts)
  // y hace el mismo warm-up de doble toBlob() que useGenerarHistoria.capturar()
  // (ver el comentario largo ahí para la razón completa: WebKit necesita una
  // pasada de rasterizado descartada para asentar el decode de las <img>
  // embebidas antes de que la captura real las incluya). El resultado de
  // prepararImagenesParaCaptura se escribe de vuelta a dataUrlsPorFoto para
  // que el estado de React no quede desincronizado del nodo DOM que
  // prepararImagenesParaCaptura mutó por fuera del ciclo de render — misma
  // razón que useGenerarHistoria hace lo propio con setFondoUri.
  // ─────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);

  const capturar = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;

    const resueltas = await prepararImagenesParaCaptura(canvasRef.current);
    if (resueltas.size > 0) {
      setDataUrlsPorFoto(prev => {
        let changed = false;
        const next = { ...prev };
        fotosOrdenadas.forEach((foto, i) => {
          const resuelto = resueltas.get(fotosUrls[i]);
          if (resuelto && next[foto.id] !== resuelto) {
            next[foto.id] = resuelto;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    await toBlob(canvasRef.current, { pixelRatio: 2 });
    return toBlob(canvasRef.current, { pixelRatio: 2 });
  }, [fotosOrdenadas, fotosUrls]);

  const descargarImagen = useCallback(async () => {
    if (!puedeCapturar) {
      await alertDialog(tStatic('historia.HistoriaPreciosPage.noContentToShow'));
      return;
    }
    let blob: Blob | null;
    try {
      blob = await capturar();
    } catch (err) {
      console.error('useHistoriaPrecios.descargarImagen: fallo al generar la imagen', err);
      await alertDialog(tStatic('historia.HistoriaPreciosPage.couldNotGenerateImage'));
      return;
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }, [puedeCapturar, capturar]);

  const compartirImagen = useCallback(async () => {
    if (!puedeCapturar) {
      await alertDialog(tStatic('historia.HistoriaPreciosPage.noContentToShow'));
      return;
    }
    let blob: Blob | null;
    try {
      blob = await capturar();
    } catch (err) {
      console.error('useHistoriaPrecios.compartirImagen: fallo al generar la imagen', err);
      await alertDialog(tStatic('historia.HistoriaPreciosPage.couldNotGenerateImage'));
      return;
    }
    if (!blob) return;

    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare) {
      const file = new File([blob], FILENAME, { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: tStatic('historia.HistoriaPreciosPage.shareTitle') });
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('useHistoriaPrecios.compartirImagen: share falló', err);
          }
        }
        return;
      }
    }

    // Fallback: mismo comportamiento que "Guardar"
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }, [puedeCapturar, capturar]);

  return {
    // professional / servicios
    effectiveProfesionalId, serviciosActivos,

    // template selection
    layoutId, estiloId, handleLayoutChange, handleEstiloChange,

    // photos
    fotos: fotosOrdenadas, fotosUrls, puedeCapturar,

    // capture / export
    canvasRef, capturar, descargarImagen, compartirImagen,
  };
}
