import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';
import { fetchAsDataUrl, prepararImagenesParaCaptura } from '@/lib/historia/captura';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { TemplateId, NotaHistoriaPrecios, NotaHistoriaPreciosModo, AlineacionNota } from '@/services/profesionalService';

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
  // agenda/nuevo (spec de referencia, 2026-08-19): `selectedProfesionalId`
  // es un override explícito (null = sin elegir), `effectiveProfesionalId`
  // NO cae en la jefa por default cuando hay más de una activa — antes sí lo
  // hacía, y la jefa aparecía "tildada" en el picker sin que nadie la
  // hubiera elegido (bug reportado por el usuario). Con exactamente 1
  // profesional activa no hay ambigüedad real: se usa implícita, sin
  // selector ni tilde visible, igual que agenda/nuevo esconde su selector
  // con activeProfesionales.length <= 1.
  // ─────────────────────────────────────────────
  const { profesionales, guardarNotaHistoriaPrecios } = useProfesionalStore();
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const activeProfesionales = useMemo(() => profesionales.filter(p => p.activo), [profesionales]);
  const effectiveProfesionalId = useMemo(() => {
    if (selectedProfesionalId) return selectedProfesionalId;
    return activeProfesionales.length === 1 ? activeProfesionales[0].id : null;
  }, [selectedProfesionalId, activeProfesionales]);
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
  // Nota adicional — texto libre y corto (aclaraciones tipo "seña 50%",
  // "el retiro tiene costo aparte") que se renderiza al pie de la tarjeta,
  // debajo de la lista de precios. Tope de 180 caracteres — mismo límite que
  // el mock v0 (price-story.tsx), pensado para una aclaración breve, no un
  // párrafo.
  //
  // Guardada POR MODO (precios/promociones, no un único string) — la
  // aclaración típica de cada uno es distinta (seña/retiro en precios,
  // vigencia de la promo en promociones), mismo criterio que
  // serviciosActivos ya filtra por `modo`. Cambiar de tab conserva lo
  // escrito en el otro modo en vez de pisarlo.
  //
  // Persiste en el backend (Profesional.historia_precios_nota, columna JSON
  // — ver NailsManagerProApi) desde 2026-08-19: una primera versión usaba
  // localStorage, pero eso se pierde al cambiar de dispositivo o reinstalar
  // la app — el usuario lo marcó como un problema real, no alcanzaba con
  // sobrevivir un refresh. Al ser un campo del Profesional (no de la
  // cuenta), la nota queda POR PROFESIONAL: cambiar de profesional en el
  // picker multi-profesional muestra la nota de esa profesional, no la que
  // se estaba editando antes — a diferencia de la versión con localStorage,
  // que era global a la cuenta sin querer. `activa` (por modo, default
  // true) deja ocultarla de la tarjeta sin borrar el texto — togglear no
  // pierde lo escrito, no hace falta tipearlo de nuevo al reactivar.
  // ─────────────────────────────────────────────
  const NOTA_MAX_LENGTH = 180;
  // Autosave debounced mientras el usuario tipea — no hay botón "Guardar"
  // para este campo, un PUT por tecla sería absurdo. 700ms: suficiente
  // pausa para no competir con el ritmo de tipeo normal, corto para no
  // sentirse "no guardado" si el usuario navega apenas termina de escribir.
  const NOTA_SAVE_DEBOUNCE_MS = 700;
  type NotaState = Record<typeof modo, NotaHistoriaPreciosModo>;
  const NOTA_DEFAULT: NotaState = {
    precios:     { texto: '', activa: true, alineacion: 'center' },
    promociones: { texto: '', activa: true, alineacion: 'center' },
  };
  // El backend puede devolver `texto: null` (Laravel normaliza '' -> null
  // antes de guardar, ver ConvertEmptyStringsToNull) — se coerciona acá,
  // no en cada call site.
  const notaDesdeServidor = (servidor: NotaHistoriaPrecios | null | undefined): NotaState => ({
    precios:     { ...NOTA_DEFAULT.precios,     ...servidor?.precios,     texto: servidor?.precios?.texto ?? '' },
    promociones: { ...NOTA_DEFAULT.promociones, ...servidor?.promociones, texto: servidor?.promociones?.texto ?? '' },
  });

  const [notaState, setNotaState] = useState<NotaState>(NOTA_DEFAULT);

  // Caché en memoria (dura la sesión, se pierde al recargar la página) del
  // notaState de CADA profesional ya vista — clave del fix de una condición
  // de carrera real encontrada en revisión: switchear A -> B -> A antes de
  // que el autosave debounced de A confirme hacía que el efecto de sync
  // (abajo) pisara la edición sin guardar de A con el valor viejo del
  // servidor (profesionalActual.historia_precios_nota TODAVÍA no reflejaba
  // el PUT en vuelo), y si el usuario retomaba a escribir sobre esa base
  // vieja, el guardado nuevo terminaba mandando texto desactualizado — la
  // edición original se perdía en serio, no solo visualmente. Con esta
  // caché, el switch de profesional NUNCA vuelve a pedirle el estado al
  // servidor una vez que esta sesión ya lo tiene local — la fuente de
  // verdad para la UI pasa a ser "lo último que el usuario tipeó en esta
  // sesión para esa profesional", el servidor solo importa la PRIMERA vez
  // que se la ve.
  const notaCache = useRef<Map<number, NotaState>>(new Map());

  // Guardado pendiente — guarda junto con el timer QUÉ profesional y QUÉ
  // valor corresponden, no solo el timer suelto (versión anterior): así
  // `flushNotaSave` puede disparar el PUT correcto al cambiar de
  // profesional o desmontar, en vez de perder la edición en silencio
  // cuando `scheduleNotaSave` de la profesional B cancelaba el timer
  // compartido que en realidad era de A (bug real, encontrado en revisión
  // — el timer no sabía de quién era, cualquier edición nueva lo pisaba).
  const notaPendiente = useRef<{ timer: ReturnType<typeof setTimeout>; profesionalId: number; next: NotaState } | null>(null);

  const flushNotaSave = useCallback(() => {
    const pendiente = notaPendiente.current;
    if (!pendiente) return;
    clearTimeout(pendiente.timer);
    notaPendiente.current = null;
    guardarNotaHistoriaPrecios(pendiente.profesionalId, pendiente.next);
  }, [guardarNotaHistoriaPrecios]);

  // Sync desde el servidor/caché — SOLO cuando cambia effectiveProfesionalId
  // (mount o switch en el picker multi-profesional), nunca en cada cambio
  // de `profesionalActual` a secas (ver comentario de notaCache arriba
  // sobre por qué). eslint-plugin-react-hooks (vía eslint-config-next)
  // marca setState-en-efecto como sub-óptimo (dispara un render extra) y
  // preferiría ajustar el estado durante el render, pero esa alternativa
  // necesita leer/escribir notaCache.current DURANTE el render, algo que
  // react-hooks/refs prohíbe directamente — probado, ver historial de este
  // archivo. Este mismo patrón (setState en un efecto para sincronizar con
  // una fuente externa al cambiar de identidad) ya aparece así en decenas
  // de lugares del resto del código (turnos, stats, etc.) — no es una
  // desviación nueva, es como este proyecto ya resuelve este caso.
  /* eslint-disable react-hooks/set-state-in-effect -- sync deliberada desde
     una fuente externa (servidor/caché) al cambiar de profesional, ver
     comentario arriba de por qué no puede vivir durante el render. */
  useEffect(() => {
    // Flushea ANTES de sincronizar/switchear — asegura que la edición
    // pendiente de la profesional que se está dejando salga hacia el
    // servidor en vez de quedar solo en notaCache hasta el próximo tecleo
    // (que podría no llegar nunca en esta sesión).
    flushNotaSave();

    if (!effectiveProfesionalId) {
      setNotaState(NOTA_DEFAULT);
      return;
    }
    const cacheada = notaCache.current.get(effectiveProfesionalId);
    if (cacheada) {
      setNotaState(cacheada);
      return;
    }
    const desdeServidor = notaDesdeServidor(profesionalActual?.historia_precios_nota);
    notaCache.current.set(effectiveProfesionalId, desdeServidor);
    setNotaState(desdeServidor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProfesionalId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Flush también al desmontar (navegar fuera de la página) — antes solo
  // se limpiaba el timer (clearTimeout sin más), perdiendo cualquier
  // edición todavía no confirmada al salir de la pantalla.
  useEffect(() => () => { flushNotaSave(); }, [flushNotaSave]);

  const scheduleNotaSave = useCallback((next: NotaState) => {
    if (!effectiveProfesionalId) return;
    if (notaPendiente.current) clearTimeout(notaPendiente.current.timer);
    const profesionalId = effectiveProfesionalId;
    const timer = setTimeout(() => {
      notaPendiente.current = null;
      guardarNotaHistoriaPrecios(profesionalId, next);
    }, NOTA_SAVE_DEBOUNCE_MS);
    notaPendiente.current = { timer, profesionalId, next };
  }, [effectiveProfesionalId, guardarNotaHistoriaPrecios]);

  // Codepoints, no unidades UTF-16: `.slice()`/`maxLength` cortan a mitad
  // de un par subrogado (emoji fuera del BMP) justo en el límite — mismo
  // criterio que la validación `max:180` del backend, que cuenta con
  // mb_strlen (codepoints).
  const cortarATope = (value: string) => Array.from(value).slice(0, NOTA_MAX_LENGTH).join('');

  const notaAdicional = notaState[modo].texto ?? '';
  const setNotaAdicional = useCallback((value: string) => {
    if (!effectiveProfesionalId) return;
    const next: NotaState = {
      ...notaState,
      [modo]: { ...notaState[modo], texto: cortarATope(value) },
    };
    notaCache.current.set(effectiveProfesionalId, next);
    setNotaState(next);
    scheduleNotaSave(next);
  }, [notaState, modo, effectiveProfesionalId, scheduleNotaSave]);

  const notaActiva = notaState[modo].activa;
  const setNotaActiva = useCallback((value: boolean) => {
    if (!effectiveProfesionalId) return;
    const next: NotaState = { ...notaState, [modo]: { ...notaState[modo], activa: value } };
    notaCache.current.set(effectiveProfesionalId, next);
    setNotaState(next);
    scheduleNotaSave(next);
  }, [notaState, modo, effectiveProfesionalId, scheduleNotaSave]);

  const notaAlineacion = notaState[modo].alineacion;
  const setNotaAlineacion = useCallback((value: AlineacionNota) => {
    if (!effectiveProfesionalId) return;
    const next: NotaState = { ...notaState, [modo]: { ...notaState[modo], alineacion: value } };
    notaCache.current.set(effectiveProfesionalId, next);
    setNotaState(next);
    scheduleNotaSave(next);
  }, [notaState, modo, effectiveProfesionalId, scheduleNotaSave]);

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

    // additional footer note
    notaAdicional, setNotaAdicional, NOTA_MAX_LENGTH,
    notaActiva, setNotaActiva,
    notaAlineacion, setNotaAlineacion,

    // photos
    fotos: fotosOrdenadas, fotosUrls, puedeCapturar,

    // capture / export
    canvasRef, capturar, descargarImagen, compartirImagen,
  };
}
