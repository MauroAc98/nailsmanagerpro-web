import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { turnoService, DisponibilidadDia, extraerMensajeError } from '@/services/turnoService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { alertDialog } from '@/store/useConfirmStore';

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
  const [fondoUri,       setFondoUri]       = useState<string | null>(null);
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
  const elegirFoto = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => setFondoUri(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

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
  // ─────────────────────────────────────────────
  const capturar = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;
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

    // navigation / mode
    handleModo, handleNavegar, setQuincena, setDiasOcultos,

    // editor
    toggleDiaOculto, toggleSlot,
    agregarTexto, iniciarEdicion, cancelarEdicion,
    actualizarPosicion, eliminarTexto, cambiarFontSize, redimensionarTexto,

    // photo / export
    elegirFoto, descargarImagen, compartirImagen,
  };
}
