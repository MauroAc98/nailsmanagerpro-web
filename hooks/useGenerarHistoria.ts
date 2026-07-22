import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { turnoService, DisponibilidadDia, extraerMensajeError } from '@/services/turnoService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { alertDialog } from '@/store/useConfirmStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { profesionalJefa } from '@/services/profesionalService';

export type Modo = 'dia' | 'semana' | 'mes';

export interface TextoLibre {
  id:       string;
  texto:    string;
  x:        number;
  y:        number;
  fontSize: number;
}

const DIAS_LARGO  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ─────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────
export function getRango(fechaBase: Date, modo: Modo): { desde: string; hasta: string } {
  if (modo === 'dia') {
    const s = fmt(fechaBase);
    return { desde: s, hasta: s };
  }

  if (modo === 'semana') {
    const lunes = new Date(fechaBase);
    const diff  = (fechaBase.getDay() + 6) % 7; // Monday-based offset
    lunes.setDate(fechaBase.getDate() - diff);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: fmt(lunes), hasta: fmt(domingo) };
  }

  const desde = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
  const hasta = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, 0);
  return { desde: fmt(desde), hasta: fmt(hasta) };
}

function tieneContenido(dias: DisponibilidadDia[]): boolean {
  return dias.some(dia => dia.slots.some(s => s.libre));
}

function filtrarQuincena(dias: DisponibilidadDia[], quincena: 0 | 1): DisponibilidadDia[] {
  return dias.filter(dia => {
    const nro = new Date(dia.fecha + 'T00:00:00').getDate();
    return quincena === 0 ? nro <= 15 : nro > 15;
  });
}

export function formatFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${DIAS_LARGO[d.getDay()]}, ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useGenerarHistoria(fechaInicial?: string) {
  const [fechaBase, setFechaBase] = useState<Date>(() =>
    fechaInicial ? new Date(fechaInicial + 'T00:00:00') : new Date()
  );
  const [modo,           setModo]           = useState<Modo>('mes');
  const [agendaGenerada, setAgendaGenerada] = useState<DisponibilidadDia[]>([]);
  const [quincena,       setQuincena]       = useState<0 | 1>(0);
  const [diasOcultos,    setDiasOcultos]    = useState<string[]>([]);
  const [textosCanvas,   setTextosCanvas]   = useState<TextoLibre[]>([]);
  const [textoInput,     setTextoInput]     = useState('');
  const [mostrarEmojis,  setMostrarEmojis]  = useState(false);
  const [editandoId,     setEditandoId]     = useState<string | null>(null);
  // Multi-agenda — null = profesional default de la cuenta (comportamiento
  // de siempre). El nombre para mostrar en el canvas se resuelve en la
  // pantalla, que tiene acceso a useProfesionalStore; el hook solo maneja el id.
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);

  // ─────────────────────────────────────────────
  // Fondo fijo por profesional — el hook sí lee useProfesionalStore acá
  // (además de por id, como arriba) porque necesita el fondo_historia_url
  // guardado, no solo el nombre. Sin selección explícita, "efectiva" cae en
  // la profesional "jefa" (primera en crearse) — mismo default que el resto
  // de la app, no la primera del array (que viene ordenado por nombre).
  // ─────────────────────────────────────────────
  const { profesionales, guardarFondoHistoria, borrarFondoHistoria } = useProfesionalStore();
  const activeProfesionales = useMemo(() => profesionales.filter(p => p.activo), [profesionales]);
  const effectiveProfesionalId = useMemo(() => {
    if (selectedProfesionalId) return selectedProfesionalId;
    return profesionalJefa(profesionales)?.id ?? null;
  }, [selectedProfesionalId, profesionales]);
  const fondoFijoGuardado = useMemo(
    () => activeProfesionales.find(p => p.id === effectiveProfesionalId)?.fondo_historia_url ?? null,
    [activeProfesionales, effectiveProfesionalId]
  );

  // Estado inicial de fondoUri sembrado con fondoFijoGuardado, no con null:
  // al navegar a esta pantalla DESDE otra parte de la app (SPA, no carga en
  // frío), el store de profesionales ya suele venir cargado, así que
  // effectiveProfesionalId resuelve de una en el primer render y nunca hay
  // una "transición" que el sync de más abajo pueda detectar — con null
  // como semilla, el fondo guardado nunca se aplicaba solo (quedaba en
  // /default_bg.jpg hasta que el usuario tocaba manualmente el selector).
  const [fondoUri, setFondoUri] = useState<string | null>(fondoFijoGuardado);

  const canvasRef      = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────
  // Canvas size — igual que RN (SCREEN_WIDTH * 0.85), no un ancho fijo.
  // Un fixed width no se adapta a celulares reales de distinto ancho;
  // acá se recalcula con el viewport real, con un tope para desktop.
  // ─────────────────────────────────────────────
  const [canvasWidth, setCanvasWidth] = useState(0);

  useEffect(() => {
    const update = () => setCanvasWidth(Math.min(420, window.innerWidth * 0.85));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const canvasHeight = (canvasWidth * 16) / 9;

  // Cargar el fondo fijo guardado como default cada vez que cambia la
  // profesional "efectiva" (selección explícita, o la única activa).
  // Ajustado durante el render, no en un efecto — patrón oficial de React
  // para resetear estado derivado cuando cambia una "key" (evita el
  // render en cascada que un setState dentro de un effect generaría). Solo
  // corre cuando effectiveProfesionalId realmente cambia, así que un fondo
  // elegido "por esta vez" en la misma profesional no se pisa solo.
  const [profesionalSincronizada, setProfesionalSincronizada] = useState(effectiveProfesionalId);
  if (profesionalSincronizada !== effectiveProfesionalId) {
    setProfesionalSincronizada(effectiveProfesionalId);
    setFondoUri(fondoFijoGuardado);
  }

  // ─────────────────────────────────────────────
  // Titulos — dos textos distintos, igual que RN (labelNavegador/labelTitulo):
  // el nav header y el título dentro del canvas NO dicen lo mismo.
  // ─────────────────────────────────────────────
  const tituloNav = useMemo(() => {
    if (modo === 'dia') return formatFechaLarga(fmt(fechaBase)).toUpperCase();

    if (modo === 'semana') {
      const { desde, hasta } = getRango(fechaBase, 'semana');
      const d = new Date(desde + 'T00:00:00');
      const h = new Date(hasta + 'T00:00:00');
      return `${d.getDate()} - ${h.getDate()} ${MESES_LARGO[h.getMonth()].toUpperCase()}`;
    }

    return `${MESES_LARGO[fechaBase.getMonth()].toUpperCase()} DE ${fechaBase.getFullYear()}`;
  }, [fechaBase, modo]);

  // Título del canvas — StoryCanvas lo uppercasea igual, así que acá no hace falta.
  const titulo = useMemo(() => {
    if (modo === 'dia') return formatFechaLarga(fmt(fechaBase));

    if (modo === 'semana') {
      const { desde, hasta } = getRango(fechaBase, 'semana');
      const d = new Date(desde + 'T00:00:00');
      const h = new Date(hasta + 'T00:00:00');
      return `Semana ${d.getDate()} al ${h.getDate()} de ${MESES_LARGO[h.getMonth()]}`;
    }

    return `Agenda ${MESES_LARGO[fechaBase.getMonth()]}`;
  }, [fechaBase, modo]);

  // ─────────────────────────────────────────────
  // Fetch effect — runs on fechaBase/modo changes only
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const cargar = async () => {
      const { desde, hasta } = getRango(fechaBase, modo);
      await withGlobalLoader(async () => {
        try {
          const data = await turnoService.getDisponibilidad(desde, hasta, selectedProfesionalId ?? undefined);
          if (cancelled) return;
          setAgendaGenerada(data);

          if (modo === 'mes') {
            const primera = filtrarQuincena(data, 0);
            const segunda = filtrarQuincena(data, 1);
            setQuincena(tieneContenido(primera) ? 0 : tieneContenido(segunda) ? 1 : 0);
          }
        } catch (e) {
          console.log('getDisponibilidad:', extraerMensajeError(e));
        }
      });
    };

    cargar();
    return () => { cancelled = true; };
  }, [fechaBase, modo, selectedProfesionalId]);

  // ─────────────────────────────────────────────
  // Reset (mode switch / date nav) — fondoUri untouched
  // ─────────────────────────────────────────────
  const resetear = useCallback(() => {
    setQuincena(0);
    setDiasOcultos([]);
    setTextosCanvas([]);
    setTextoInput('');
    setMostrarEmojis(false);
  }, []);

  const handleModo = useCallback((nuevoModo: Modo) => {
    setModo(nuevoModo);
    resetear();
  }, [resetear]);

  const handleNavegar = useCallback((offset: 1 | -1) => {
    setFechaBase(prev => {
      if (modo === 'dia') {
        const d = new Date(prev);
        d.setDate(d.getDate() + offset);
        return d;
      }
      if (modo === 'semana') {
        const d = new Date(prev);
        d.setDate(d.getDate() + offset * 7);
        return d;
      }
      // modo === 'mes' — manual year/month arithmetic, clamp day to avoid overflow
      const day = prev.getDate();
      let year  = prev.getFullYear();
      let month = prev.getMonth() + offset;
      if (month < 0)  { month = 11; year -= 1; }
      if (month > 11) { month = 0;  year += 1; }
      const daysInTarget = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, daysInTarget));
    });
    resetear();
  }, [modo, resetear]);

  // ─────────────────────────────────────────────
  // Derived quincena/hidden-day slices
  // ─────────────────────────────────────────────
  const diasQuincena = useMemo(() => {
    if (modo !== 'mes') return agendaGenerada;
    return filtrarQuincena(agendaGenerada, quincena);
  }, [agendaGenerada, modo, quincena]);

  const diasAMostrar = useMemo(
    () => diasQuincena.filter(dia => !diasOcultos.includes(dia.fecha)),
    [diasQuincena, diasOcultos]
  );

  const hayContenido = useMemo(() => tieneContenido(diasAMostrar), [diasAMostrar]);

  // ─────────────────────────────────────────────
  // Day-hide / slot toggle (cosmetic-only, client-side)
  // ─────────────────────────────────────────────
  const toggleDiaOculto = useCallback((fecha: string) => {
    setDiasOcultos(prev =>
      prev.includes(fecha) ? prev.filter(f => f !== fecha) : [...prev, fecha]
    );
  }, []);

  const toggleSlot = useCallback((fechaIdx: number, slotIdx: number) => {
    const fechaReal = diasQuincena[fechaIdx]?.fecha;
    if (!fechaReal) return;
    setAgendaGenerada(prev =>
      prev.map(dia =>
        dia.fecha !== fechaReal ? dia : {
          ...dia,
          slots: dia.slots.map((slot, si) =>
            si !== slotIdx ? slot : { ...slot, libre: !slot.libre }
          ),
        }
      )
    );
  }, [diasQuincena]);

  // Ocultar/restaurar una hora puntual en todos los días actualmente
  // visibles (respeta el filtro día/semana/mes y la quincena activa, porque
  // opera sobre diasQuincena — lo mismo que ya se le pasa a AgendaEditor).
  // Si la hora todavía está libre en algún día visible, oculta esa hora en
  // todos; si ya está oculta en todos, la restaura en todos — mismo criterio
  // de toggle que un "seleccionar todo".
  const toggleHoraEnTodos = useCallback((hora: string) => {
    const fechasVisibles = new Set(diasQuincena.map(d => d.fecha));
    const hayAlgunaLibre = diasQuincena.some(dia =>
      dia.slots.some(s => s.hora === hora && s.libre)
    );
    const nuevoLibre = !hayAlgunaLibre;

    setAgendaGenerada(prev =>
      prev.map(dia =>
        !fechasVisibles.has(dia.fecha) ? dia : {
          ...dia,
          slots: dia.slots.map(slot =>
            slot.hora !== hora ? slot : { ...slot, libre: nuevoLibre }
          ),
        }
      )
    );
  }, [diasQuincena]);

  // ─────────────────────────────────────────────
  // Free-text CRUD — agregarTexto doubles as "guardar" when editandoId
  // is set, so the same input/button drives add and edit.
  // ─────────────────────────────────────────────
  const agregarTexto = useCallback(() => {
    if (!textoInput.trim()) return;

    if (editandoId) {
      setTextosCanvas(prev =>
        prev.map(t => t.id === editandoId ? { ...t, texto: textoInput.trim() } : t)
      );
      setEditandoId(null);
    } else {
      setTextosCanvas(prev => [...prev, {
        id:       Date.now().toString(),
        texto:    textoInput.trim(),
        x:        canvasWidth / 2 - 80,
        y:        canvasHeight * 0.75,
        fontSize: 12,
      }]);
    }

    setTextoInput('');
    setMostrarEmojis(false);
  }, [textoInput, canvasWidth, canvasHeight, editandoId]);

  const iniciarEdicion = useCallback((id: string) => {
    const item = textosCanvas.find(t => t.id === id);
    if (!item) return;
    setEditandoId(id);
    setTextoInput(item.texto);
    setMostrarEmojis(false);
  }, [textosCanvas]);

  const cancelarEdicion = useCallback(() => {
    setEditandoId(null);
    setTextoInput('');
  }, []);

  const actualizarPosicion = useCallback((id: string, x: number, y: number) => {
    setTextosCanvas(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  }, []);

  const eliminarTexto = useCallback((id: string) => {
    setTextosCanvas(prev => prev.filter(t => t.id !== id));
    if (editandoId === id) {
      setEditandoId(null);
      setTextoInput('');
    }
  }, [editandoId]);

  const cambiarFontSize = useCallback((id: string, delta: 1 | -1) => {
    setTextosCanvas(prev =>
      prev.map(t => t.id === id ? { ...t, fontSize: Math.min(28, Math.max(8, t.fontSize + delta)) } : t)
    );
  }, []);

  // Absolute set — used by the drag-to-resize handle on the canvas pill,
  // where the gesture computes a target size directly instead of a step delta.
  const redimensionarTexto = useCallback((id: string, fontSize: number) => {
    const clamped = Math.round(Math.min(28, Math.max(8, fontSize)));
    setTextosCanvas(prev =>
      prev.map(t => t.id === id ? { ...t, fontSize: clamped } : t)
    );
  }, []);

  // ─────────────────────────────────────────────
  // Photo picker — base64 data URL, not an object URL. blob: URLs can't be
  // resolved by html-to-image's SVG foreignObject serialization on Safari
  // iOS, which left the exported story with a black background even though
  // the live preview looked fine.
  // ─────────────────────────────────────────────
  // guardarFijo: además de mostrarla ya mismo (siempre, vía data URL — no
  // hace falta esperar la subida para previsualizar), la sube al backend
  // como fondo fijo de la profesional efectiva. Si esa subida falla, la
  // imagen elegida se sigue usando igual "por esta vez" — solo se avisa
  // que no quedó guardada para la próxima.
  const elegirFoto = useCallback((file: File, guardarFijo: boolean) => {
    const reader = new FileReader();
    reader.onload = async () => {
      setFondoUri(reader.result as string);

      if (!guardarFijo) return;

      let profesionalId = effectiveProfesionalId;

      // Si todavía no hay ninguna profesional resuelta puede ser que el
      // fetch de /profesionales (disparado al entrar a la pantalla) no
      // haya terminado todavía — pasa si se elige "guardar fijo" muy rápido
      // después de entrar. Un solo reintento del fetch alcanza para el caso
      // real (red normal); si sigue sin resolver una profesional puntual
      // (ninguna activa, o multi-agenda sin selección), ahí sí es un caso
      // genuino sin identificar.
      if (!profesionalId) {
        await useProfesionalStore.getState().fetchProfesionales();
        profesionalId = selectedProfesionalId ?? profesionalJefa(useProfesionalStore.getState().profesionales)?.id ?? null;
      }

      if (!profesionalId) {
        await alertDialog('No se pudo identificar la profesional para guardar el fondo fijo. Se usa solo por esta vez.');
        return;
      }

      const resultado = await guardarFondoHistoria(profesionalId, file);
      if (!resultado.success) {
        await alertDialog(resultado.message ?? 'No se pudo guardar el fondo fijo. Se usa solo por esta vez.');
      }
    };
    reader.readAsDataURL(file);
  }, [effectiveProfesionalId, selectedProfesionalId, guardarFondoHistoria]);

  const quitarFondoFijo = useCallback(async () => {
    if (!effectiveProfesionalId) return;
    const resultado = await borrarFondoHistoria(effectiveProfesionalId);
    if (resultado.success) {
      setFondoUri(null);
    } else {
      await alertDialog(resultado.message ?? 'No se pudo quitar el fondo fijo.');
    }
  }, [effectiveProfesionalId, borrarFondoHistoria]);

  // ─────────────────────────────────────────────
  // Capture helper — rasterize StoryCanvas DOM node.
  //
  // Warm-up capture: html-to-image renders by serializing the node into an
  // SVG foreignObject and rasterizing that through an off-DOM Image element.
  // On iOS WebKit (all browsers there, not just Safari) that first raster
  // pass frequently drops embedded raster images — the background photo
  // renders blank/transparent — because the SVG->Image decode is async and
  // WebKit doesn't reliably await it before painting to canvas. A discarded
  // warm-up call primes that decode so the following real capture includes
  // the background. Never reproduces on Android/Chromium. See
  // https://github.com/bubkoo/html-to-image/issues/420 and
  // https://github.com/tsayen/dom-to-image/issues/343.
  //
  // That warm-up alone assumed the <img> itself was already decoded, which
  // holds for the saved fondo fijo (loaded on mount, long before the user
  // taps compartir) but not for a background just picked "por esta vez" —
  // an un-resized camera photo can still be mid-decode when the user shares
  // right after picking it, so the warm-up races it and loses, exporting a
  // black background. Waiting on the real <img>'s decode() first removes
  // that race instead of just guessing at extra timing.
  // ─────────────────────────────────────────────
  const capturar = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;

    const img = canvasRef.current.querySelector('img');
    if (img) {
      try {
        await img.decode();
      } catch {
        // imagen todavía sin src resuelto o decode no soportado — seguimos
        // igual, el warm-up de abajo es el mejor esfuerzo que queda
      }
    }

    await toBlob(canvasRef.current, { pixelRatio: 2 });
    return toBlob(canvasRef.current, { pixelRatio: 2 });
  }, []);

  const descargarImagen = useCallback(async () => {
    if (!hayContenido) {
      await alertDialog('Sin contenido: No hay slots libres para mostrar en la imagen.');
      return;
    }
    const blob = await capturar();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'mi-agenda.png';
    a.click();
    URL.revokeObjectURL(url);
  }, [hayContenido, capturar]);

  const compartirImagen = useCallback(async () => {
    if (!hayContenido) return;
    const blob = await capturar();
    if (!blob) return;

    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare) {
      const file = new File([blob], 'mi-agenda.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Mi agenda' });
        } catch {
          // usuario canceló o compartir falló — no-op silencioso
        }
        return;
      }
    }

    // Fallback: mismo comportamiento que "Guardar"
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'mi-agenda.png';
    a.click();
    URL.revokeObjectURL(url);
  }, [hayContenido, capturar]);

  return {
    // state
    fechaBase, modo, fondoUri, quincena, diasOcultos,
    agendaGenerada, diasQuincena, diasAMostrar, hayContenido, titulo, tituloNav,
    textosCanvas, textoInput, setTextoInput, mostrarEmojis, setMostrarEmojis,
    editandoId, canvasRef, canvasWidth, canvasHeight,
    selectedProfesionalId, setSelectedProfesionalId,
    fondoFijoGuardado,

    // navigation / mode
    handleModo, handleNavegar, setQuincena, setDiasOcultos,

    // editor
    toggleDiaOculto, toggleSlot, toggleHoraEnTodos,
    agregarTexto, iniciarEdicion, cancelarEdicion,
    actualizarPosicion, eliminarTexto, cambiarFontSize, redimensionarTexto,

    // photo / export
    elegirFoto, quitarFondoFijo, descargarImagen, compartirImagen,
  };
}
