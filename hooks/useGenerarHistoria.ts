import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { turnoService, DisponibilidadDia, extraerMensajeError } from '@/services/turnoService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { alertDialog } from '@/store/useConfirmStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { profesionalJefa } from '@/services/profesionalService';
import { nombreDia, nombreMes } from '@/lib/dateFormat';
import { tStatic } from '@/store/useLocaleStore';
import { fetchAsDataUrl, resizeFondoFile, prepararImagenesParaCaptura } from '@/lib/historia/captura';

export type Modo = 'dia' | 'semana' | 'mes';

export interface TextoLibre {
  id:       string;
  texto:    string;
  x:        number;
  y:        number;
  fontSize: number;
}

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

// Identifica un slot por fecha+hora — clave estable para el set de slots
// ocultados manualmente (independiente del índice, que puede correrse si
// cambia la data del backend).
export function claveSlot(fecha: string, hora: string): string {
  return `${fecha}|${hora}`;
}

function filtrarQuincena(dias: DisponibilidadDia[], quincena: 0 | 1): DisponibilidadDia[] {
  return dias.filter(dia => {
    const nro = new Date(dia.fecha + 'T00:00:00').getDate();
    return quincena === 0 ? nro <= 15 : nro > 15;
  });
}

export function formatFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return `${nombreDia(d, 'long')}, ${d.getDate()} de ${nombreMes(d, 'long')}`;
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
  // Claves (claveSlot) de slots que el usuario ocultó manualmente de la
  // imagen. Nunca incluye slots que el sistema marca ocupados — eso se
  // garantiza en toggleSlot/toggleHoraEnTodos, no acá.
  const [slotsOcultos,   setSlotsOcultos]   = useState<string[]>([]);
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
  const nombreEstudio = useAuthStore(s => s.user?.name ?? null);
  const telefonoEstudio = useAuthStore(s => s.user?.telefono ?? null);
  const activeProfesionales = useMemo(() => profesionales.filter(p => p.activo), [profesionales]);
  const effectiveProfesionalId = useMemo(() => {
    if (selectedProfesionalId) return selectedProfesionalId;
    return profesionalJefa(profesionales)?.id ?? null;
  }, [selectedProfesionalId, profesionales]);
  const fondoFijoGuardado = useMemo(
    () => activeProfesionales.find(p => p.id === effectiveProfesionalId)?.fondo_historia_url ?? null,
    [activeProfesionales, effectiveProfesionalId]
  );

  // fondoFijoGuardado es una URL pública del backend, servida sin
  // Access-Control-Allow-Origin — html-to-image no puede embeberla al
  // capturar. La reescribimos a nuestro propio proxy same-origin
  // (app/api/historia-fondo) solo para el src que efectivamente se
  // renderiza/captura; fondoFijoGuardado en sí queda intacto porque también
  // se usa como identidad (¿hay fondo guardado?), no solo como URL de imagen.
  const proxiedFondoFijoGuardado = useMemo(
    () => (fondoFijoGuardado ? `/api/historia-fondo?url=${encodeURIComponent(fondoFijoGuardado)}` : null),
    [fondoFijoGuardado]
  );

  // Estado inicial de fondoUri sembrado con fondoFijoGuardado, no con null:
  // al navegar a esta pantalla DESDE otra parte de la app (SPA, no carga en
  // frío), el store de profesionales ya suele venir cargado, así que
  // effectiveProfesionalId resuelve de una en el primer render y nunca hay
  // una "transición" que el sync de más abajo pueda detectar — con null
  // como semilla, el fondo guardado nunca se aplicaba solo (quedaba en
  // /default_bg.jpg hasta que el usuario tocaba manualmente el selector).
  const [fondoUri, setFondoUri] = useState<string | null>(proxiedFondoFijoGuardado);

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
    setFondoUri(proxiedFondoFijoGuardado);
  }

  // ─────────────────────────────────────────────
  // Resolver el fondo fijo a data: URL apenas se conoce (mount / cambio de
  // profesional), no recién al capturar. Antes ese fetch+conversión vivía
  // DENTRO de capturar(), así que corría en la ventana más angosta posible
  // — justo cuando el usuario tocaba "compartir" — compitiendo por esos
  // mismos milisegundos contra la rasterización SVG interna de
  // html-to-image. Esa competencia por la misma ventana angosta era la
  // causa real de que arreglar "fijo" pareciera romper "por esta vez": los
  // dos flujos terminaban apostando al mismo margen de tiempo en vez de que
  // uno de los dos (el de red) llegara resuelto con segundos de sobra. Acá
  // el fetch arranca apenas se conoce el fondo fijo, así que para cuando el
  // usuario realmente comparte, fondoUri casi siempre YA es data: — el
  // mismo camino sin ramas que "por esta vez" usa desde que se elige la
  // foto.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!proxiedFondoFijoGuardado) return;
    let cancelled = false;

    fetchAsDataUrl(proxiedFondoFijoGuardado)
      .then(dataUrl => {
        if (cancelled) return;
        // Solo pisa fondoUri si seguimos mostrando ESTE fondo fijo — si
        // mientras tanto el usuario ya eligió "por esta vez" u otra
        // profesional, no lo pisamos.
        setFondoUri(prev => (prev === proxiedFondoFijoGuardado ? dataUrl : prev));
      })
      .catch(() => {
        // fetch falló (offline, proxy caído) — fondoUri queda en la url de
        // red; capturar() la resuelve como último recurso al compartir.
      });

    return () => { cancelled = true; };
  }, [proxiedFondoFijoGuardado]);

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
      return `${d.getDate()} - ${h.getDate()} ${nombreMes(h, 'long', 'mayusculas')}`;
    }

    return `${nombreMes(fechaBase, 'long', 'mayusculas')} DE ${fechaBase.getFullYear()}`;
  }, [fechaBase, modo]);

  // Fecha del canvas — solo el rango/fecha, sin el prefijo "Turnos" (ese
  // label fijo ahora lo pone StoryCanvas como parte del header, ver el
  // rediseño de v0 que separa nombre / "TURNOS DISPONIBLES" / fecha en tres
  // líneas en vez de una sola). Se mantiene corto a propósito: esta línea no
  // tiene auto-shrink (StoryCanvas no la envuelve en FitText como al nombre
  // de la profesional), así que un texto más largo se desborda en pantallas
  // angostas.
  const titulo = useMemo(() => {
    if (modo === 'dia') return formatFechaLarga(fmt(fechaBase)).replace(', ', ' ');

    if (modo === 'semana') {
      const { desde, hasta } = getRango(fechaBase, 'semana');
      const d = new Date(desde + 'T00:00:00');
      const h = new Date(hasta + 'T00:00:00');
      return `${d.getDate()} al ${h.getDate()} de ${nombreMes(h, 'long')}`;
    }

    return nombreMes(fechaBase, 'long');
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
    setSlotsOcultos([]);
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

  // diasAMostrar es lo único que llega al canvas — acá se aplica el overlay
  // de slotsOcultos por encima del dato real (diasQuincena/agendaGenerada
  // nunca se tocan), así un turno ocupado jamás puede terminar mostrándose
  // como disponible en la imagen.
  const diasAMostrar = useMemo(
    () => diasQuincena
      .filter(dia => !diasOcultos.includes(dia.fecha))
      .map(dia => ({
        ...dia,
        slots: dia.slots.map(slot =>
          slotsOcultos.includes(claveSlot(dia.fecha, slot.hora))
            ? { ...slot, libre: false }
            : slot
        ),
      })),
    [diasQuincena, diasOcultos, slotsOcultos]
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

  // Solo puede ocultar/restaurar un slot que el sistema ya marca libre —
  // un turno ocupado nunca es togglable, así no hay forma de que termine
  // mostrándose como disponible en la historia.
  const toggleSlot = useCallback((fechaIdx: number, slotIdx: number) => {
    const dia  = diasQuincena[fechaIdx];
    const slot = dia?.slots[slotIdx];
    if (!dia || !slot || !slot.libre) return;

    const clave = claveSlot(dia.fecha, slot.hora);
    setSlotsOcultos(prev =>
      prev.includes(clave) ? prev.filter(k => k !== clave) : [...prev, clave]
    );
  }, [diasQuincena]);

  // Ocultar/restaurar una hora puntual en todos los días actualmente
  // visibles (respeta el filtro día/semana/mes y la quincena activa, porque
  // opera sobre diasQuincena — lo mismo que ya se le pasa a AgendaEditor).
  // Solo considera los slots que el sistema marca libres en esos días —
  // los ocupados quedan afuera del cálculo y nunca se tocan.
  const toggleHoraEnTodos = useCallback((hora: string) => {
    const clavesLibres = diasQuincena
      .filter(dia => dia.slots.some(s => s.hora === hora && s.libre))
      .map(dia => claveSlot(dia.fecha, hora));
    if (clavesLibres.length === 0) return;

    const hayAlgunaVisible = clavesLibres.some(clave => !slotsOcultos.includes(clave));

    setSlotsOcultos(prev => {
      const sinEstas = prev.filter(k => !clavesLibres.includes(k));
      return hayAlgunaVisible ? [...sinEstas, ...clavesLibres] : sinEstas;
    });
  }, [diasQuincena, slotsOcultos]);

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
  //
  // La foto elegida se redimensiona ANTES de convertirse en fondoUri o de
  // subirse (ver resizeFondoFile en lib/historia/captura.ts) — sin este paso, elegir una segunda
  // foto en la misma sesión (por esta vez o fijo, cualquier combinación)
  // exportaba la historia con fondo negro: cada foto sin achicar son varios
  // MB a resolución de cámara, y capturar() rasteriza esa imagen dos veces
  // por captura a través del pipeline SVG-foreignObject de html-to-image, que
  // decodifica el <img> a su resolución original sin importar el tamaño en
  // pantalla. La presión de memoria de decodificación se acumula entre
  // capturas — WebKit en iOS devuelve buffers en blanco/negro bajo esa
  // presión en vez de tirar un error, por eso la primera captura salía bien
  // y recién la segunda (memoria acumulada de la primera + la foto nueva)
  // fallaba.
  const elegirFoto = useCallback((file: File, guardarFijo: boolean) => {
    void (async () => {
      let dataUrl: string;
      let archivoParaSubir: File = file;

      try {
        const resized = await resizeFondoFile(file);
        dataUrl = resized.dataUrl;
        archivoParaSubir = resized.file;
      } catch {
        // Redimensionar falló (formato no soportado, canvas bloqueado, etc.)
        // — mismo comportamiento que antes de este fix: se sigue usando la
        // foto original tal cual. Peor para memoria en iOS, pero no rompe
        // la función.
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      }

      setFondoUri(dataUrl);

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
        await alertDialog(tStatic('historia.HistoriaPage.noProfessionalForFixedBg'));
        return;
      }

      const resultado = await guardarFondoHistoria(profesionalId, archivoParaSubir);
      if (!resultado.success) {
        await alertDialog(resultado.message ?? tStatic('historia.HistoriaPage.couldNotSaveFixedBackground'));
      }
    })();
  }, [effectiveProfesionalId, selectedProfesionalId, guardarFondoHistoria]);

  const quitarFondoFijo = useCallback(async () => {
    if (!effectiveProfesionalId) return;
    const resultado = await borrarFondoHistoria(effectiveProfesionalId);
    if (resultado.success) {
      setFondoUri(null);
    } else {
      await alertDialog(resultado.message ?? tStatic('historia.HistoriaPage.couldNotRemoveFixedBackground'));
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
  //
  // img.decode() only confirms the DOM <img> itself decoded — html-to-image
  // doesn't capture that node directly, it serializes the tree into an SVG
  // foreignObject and rasterizes THAT through its own off-DOM Image, a
  // separate pipeline decode() can't see into. Two rAF frames after
  // decode() give WebKit's paint pipeline extra settle time, independent of
  // how fast the user taps compartir.
  //
  // The shared root cause behind "fixing fijo re-breaks por esta vez" (and
  // vice versa): both flows were racing the SAME narrow window — the couple
  // hundred ms between tapping compartir and toBlob() finishing its (now
  // doubled) SVG rasterization pass. "por esta vez" races an un-resized
  // camera photo's decode; "fijo" used to ALSO cram a network round-trip
  // (proxy fetch -> blob -> FileReader) into that exact window. That
  // mutate-then-capture approach was structurally sound — html-to-image's
  // cloneNode() (node_modules/html-to-image/lib/clone-node.js) reads the
  // live <img>.src at the moment EACH toBlob() call clones the tree, so a
  // src mutated right before capture is picked up on both the warm-up and
  // the real call. The actual bug was stacking a network round-trip on top
  // of an already-marginal timing budget instead of getting it out of that
  // budget entirely. The fondo fijo is now resolved to a data: URL
  // proactively (see the effect above, keyed on proxiedFondoFijoGuardado)
  // the moment it's known — mount or profesional switch — with seconds of
  // slack instead of milliseconds, so by the time compartir actually runs
  // fondoUri is normally ALREADY a data: URL, the same zero-branch path
  // "por esta vez" always used.
  //
  // The fetch->data:/decode()/settle sequence itself now lives in
  // `lib/historia/captura.ts` (prepararImagenesParaCaptura), shared with
  // the price-story canvas — it's a last-resort fallback for the rare case
  // the effect above hasn't resolved yet (share tapped immediately) or
  // failed, generalized from this single-<img> path to N images. We still
  // write the resolved data: URL back through setFondoUri here so React's
  // state doesn't drift from a DOM node mutated outside its render cycle —
  // that reconciliation is this hook's job, not the shared module's.
  // ─────────────────────────────────────────────
  const capturar = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;

    const resueltas = await prepararImagenesParaCaptura(canvasRef.current);
    for (const dataUrl of resueltas.values()) {
      setFondoUri(dataUrl);
    }

    await toBlob(canvasRef.current, { pixelRatio: 2 });
    return toBlob(canvasRef.current, { pixelRatio: 2 });
  }, []);

  const descargarImagen = useCallback(async () => {
    if (!hayContenido) {
      await alertDialog(tStatic('historia.HistoriaPage.noContentToShow'));
      return;
    }
    let blob: Blob | null;
    try {
      blob = await capturar();
    } catch (err) {
      console.error('descargarImagen: fallo al generar la imagen', err);
      await alertDialog(tStatic('historia.HistoriaPage.couldNotGenerateImage'));
      return;
    }
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
    let blob: Blob | null;
    try {
      blob = await capturar();
    } catch (err) {
      console.error('compartirImagen: fallo al generar la imagen', err);
      await alertDialog(tStatic('historia.HistoriaPage.couldNotGenerateImage'));
      return;
    }
    if (!blob) return;

    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare) {
      const file = new File([blob], 'mi-agenda.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: tStatic('historia.HistoriaPage.shareTitle') });
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('compartirImagen: share falló', err);
          }
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
    fechaBase, modo, fondoUri, quincena, diasOcultos, slotsOcultos,
    agendaGenerada, diasQuincena, diasAMostrar, hayContenido, titulo, tituloNav,
    textosCanvas, textoInput, setTextoInput, mostrarEmojis, setMostrarEmojis,
    editandoId, canvasRef, canvasWidth, canvasHeight,
    selectedProfesionalId, setSelectedProfesionalId, effectiveProfesionalId,
    fondoFijoGuardado, nombreEstudio, telefonoEstudio,

    // navigation / mode
    handleModo, handleNavegar, setQuincena, setDiasOcultos, setSlotsOcultos,

    // editor
    toggleDiaOculto, toggleSlot, toggleHoraEnTodos,
    agregarTexto, iniciarEdicion, cancelarEdicion,
    actualizarPosicion, eliminarTexto, cambiarFontSize, redimensionarTexto,

    // photo / export
    elegirFoto, quitarFondoFijo, descargarImagen, compartirImagen,
  };
}
