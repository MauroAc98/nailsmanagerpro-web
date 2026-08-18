import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';
import { fetchAsDataUrl, prepararImagenesParaCaptura } from '@/lib/historia/captura';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { profesionalJefa, TemplateId } from '@/services/profesionalService';

const DEFAULT_TEMPLATE: TemplateId = 'feature';
const FILENAME = 'historia-precios.png';

// Ancho de exportación fijo — mismo criterio que useGenerarHistoria.capturar:
// 1080px es la resolución estándar recomendada por Instagram Stories y
// WhatsApp Estados (formato 9:16). HistoriaPreciosCanvas renderiza siempre a
// BASE_WIDTH=420 (ver D3 en sdd/dynamic-price-story), así que un
// pixelRatio:2 fijo exportaba siempre 840x1493, por debajo de ese estándar.
const STORY_EXPORT_WIDTH = 1080;

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
  // Professional context — same multi-profesional picker pattern as
  // useGenerarHistoria: `selectedProfesionalId` is an explicit override
  // (null = no selection), `effectiveProfesionalId` falls back to the jefa
  // when nothing's selected. Layout/estilo/fotos stay scoped to whichever
  // professional is "effective" so each one can promote her own promos/
  // servicios, not just the jefa's.
  // ─────────────────────────────────────────────
  const { profesionales } = useProfesionalStore();
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const effectiveProfesionalId = useMemo(() => {
    if (selectedProfesionalId) return selectedProfesionalId;
    return profesionalJefa(profesionales)?.id ?? null;
  }, [selectedProfesionalId, profesionales]);
  const profesionalActual = useMemo(
    () => profesionales.find(p => p.id === effectiveProfesionalId) ?? null,
    [profesionales, effectiveProfesionalId]
  );

  // ─────────────────────────────────────────────
  // Footer credit — account-level (`User.name`/`User.telefono` via
  // useAuthStore), NOT the profesional-level data above. Same slot the
  // reference Canva price-list used for a professional's @handle, but the
  // business name/phone belong to the account, not to `Profesional`.
  // ─────────────────────────────────────────────
  const { user } = useAuthStore();
  const nombreNegocio = user?.name ?? '';
  const telefono = user?.telefono ?? null;

  // Modo — separa "Precios" (servicios fijos, es_promo:false) de
  // "Promociones" (es_promo:true) en 2 imágenes distintas, cada una con su
  // propio título de card (ver page.tsx) y su propia lista filtrada acá.
  // Reemplaza el comportamiento anterior donde ambos se mezclaban en una
  // sola lista sin distinción visual.
  const [modo, setModo] = useState<'precios' | 'promociones'>('precios');
  const handleModoChange = useCallback((id: 'precios' | 'promociones') => setModo(id), []);

  // Servicios activos — filtrados por `modo` (es_promo según corresponda) Y
  // restringidos a los servicios de profesionalActual (mismo criterio que
  // agenda/nuevo cuando hay más de una profesional:
  // `profesionalSeleccionado.servicios.some(...)`) — la historia de precios
  // es un artefacto por profesional (layout/estilo/fotos viven en
  // Profesional, no en la cuenta), así que mostrar el catálogo entero de la
  // cuenta filtraría mal en cuentas con varias profesionales con servicios
  // asignados por separado.
  const { servicios } = useServiciosStore();
  const serviciosActivos = useMemo(
    () => profesionalActual
      ? servicios.filter(s =>
          s.activo &&
          s.es_promo === (modo === 'promociones') &&
          profesionalActual.servicios.some(ps => ps.id === s.id)
        )
      : [],
    [servicios, profesionalActual, modo]
  );

  // ─────────────────────────────────────────────
  // Selección de plantilla — puramente local a esta sesión. Ningún task de
  // las 6 fases persiste esta selección de vuelta al backend (D1 define el
  // contrato PUT pero ninguna fase lo llama todavía) — queda como ítem
  // abierto, ver apply-progress.
  // ─────────────────────────────────────────────
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const handleTemplateChange = useCallback((id: TemplateId) => setTemplateId(id), []);

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

  // Las 8 plantillas del catálogo actual piden al menos 1 foto (ver
  // catalogo.ts, minFotos) — no hay plantilla sin foto de fondo, a
  // diferencia del catálogo anterior ('type'/Tipográfico, minFotos: 0).
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

    // document.fonts.ready — same class of bug prepararImagenesParaCaptura
    // guards against for <img>s (decode()+settle before rasterizing), but
    // for the self-hosted, lazy-loaded serif (TarjetaPrecios's title, see
    // app/layout.tsx). Without this, toBlob() can run before the browser
    // finishes swapping in the real font (next/font's `display: 'swap'`),
    // silently baking the fallback font into the exported PNG forever while
    // the on-screen preview looks correct once it loads a moment later.
    // Standard Font Loading API — supported in all target browsers
    // including iOS Safari.
    await document.fonts.ready;

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

    // pixelRatio calculado, no fijo — mismo motivo que useGenerarHistoria:
    // el PNG exportado sale a STORY_EXPORT_WIDTH de ancho real sin importar
    // el ancho intrínseco del canvas (BASE_WIDTH).
    const pixelRatio = STORY_EXPORT_WIDTH / canvasRef.current.getBoundingClientRect().width;

    await toBlob(canvasRef.current, { pixelRatio });
    return toBlob(canvasRef.current, { pixelRatio });
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
    selectedProfesionalId, setSelectedProfesionalId,

    // footer credit (account-level)
    nombreNegocio, telefono,

    // template selection
    templateId, handleTemplateChange,
    modo, handleModoChange,

    // photos
    fotos: fotosOrdenadas, fotosUrls, puedeCapturar,

    // capture / export
    canvasRef, capturar, descargarImagen, compartirImagen,
  };
}
