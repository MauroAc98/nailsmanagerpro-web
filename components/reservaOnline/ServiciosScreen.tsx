'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso, rutaServicio } from '@/lib/reservaOnline/rutas';
import { formatMontoCorto } from '@/lib/money';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import type { BookableService } from '@/lib/reservaOnline/types';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoBrillo, IcoCheck, IcoReloj } from './iconos';
import { NoDisponibleAun } from './NoDisponibleAun';
import { EtiquetaPromo, PasosPromo, PastillaModo } from './PromoIncluye';
import { BarraInferior, BotonPrimario, Hueso, Mensaje, PasoHeader } from './ui';

const GAP_TARJETA = 14;

const MAX_PASOS_VISIBLES = 3;

// Encabezado de la tarjeta: etiqueta PROMO, nombre y categoria. El nombre NUNCA
// se recorta: la clienta decide con el, asi que se parte en las lineas que haga
// falta. Tipografia mas grande que el resto de la app: esta pantalla la usa
// cualquier clienta, incluidas personas mayores, y es la primera decision de
// todo el flujo.
function CabeceraServicio({ s, mostrarCategoria }: { s: BookableService; mostrarCategoria: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
      {s.promoComponentizada && <EtiquetaPromo />}
      <div
        style={{
          fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: colors.textStrong, overflowWrap: 'anywhere',
          marginTop: s.promoComponentizada ? 5 : 0,
        }}
      >
        {s.nombre}
      </div>
      {mostrarCategoria && s.categoria && (
        <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 2 }}>{s.categoria.nombre}</div>
      )}
    </div>
  );
}

// "Incluye": los servicios de la promo con su profesional. En secuencia van
// numerados y unidos por una linea; a la vez, bajo una barra unica. Desde el
// 4.o paso se pliegan bajo un boton (44px) para que la tarjeta no crezca sin
// limite. El boton NO selecciona el servicio (frena el click antes de que
// llegue a la tarjeta).
function DetallePromo({ s, expandido, onToggle }: { s: BookableService; expandido: boolean; onToggle: () => void }) {
  const t = useTranslations('reservaOnline.servicios');
  const componentes = s.componentes ?? [];
  const paralelo = s.modoPromo === 'paralelo';
  const plegable = componentes.length > MAX_PASOS_VISIBLES;
  const visibles = plegable && !expandido ? componentes.slice(0, MAX_PASOS_VISIBLES) : componentes;
  return (
    <div style={{ background: colors.surface2, borderRadius: 12, padding: '12px 14px', marginTop: 12, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: colors.sub, textTransform: 'uppercase' }}>
          {t('incluye')}
        </span>
        <PastillaModo paralelo={paralelo} />
      </div>
      <PasosPromo componentes={visibles} paralelo={paralelo} />
      {plegable && (
        <button
          type="button"
          aria-expanded={expandido}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: '100%', minHeight: 44, marginTop: 10, padding: 0, background: 'none', border: 'none',
            borderTop: `1px solid ${colors.divider}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: colors.primaryDeep,
          }}
        >
          <span style={{ flex: 1 }}>
            {expandido ? t('verMenos') : t('verRestantes', { count: componentes.length - MAX_PASOS_VISIBLES })}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            style={{ transform: expandido ? 'rotate(180deg)' : undefined }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Pie: duracion a la izquierda (en una promo, "en total") y el precio de
// REFERENCIA a la derecha: etiqueta "Desde" chica sobre el monto (el valor
// final lo confirma el negocio). Sin precio cargado: "Precio a consultar" en
// vez de un "Desde $0".
function PieServicio({ s }: { s: BookableService }) {
  const t = useTranslations('reservaOnline.servicios');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 12, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: colors.sub }}>
        <IcoReloj color={colors.muted} size={16} />
        <span>{formatearDuracion(s.duracionMinutos)}</span>
        {s.promoComponentizada && <span>{t('enTotal')}</span>}
      </div>
      {s.precio > 0 ? (
        <div style={{ textAlign: 'right', lineHeight: 1 }}>
          <div style={{ fontSize: 11, color: colors.sub, marginBottom: 3 }}>{t('desdeEtiqueta')}</div>
          <div style={{ fontFamily: agendaFontSerif, fontSize: 21, color: colors.strong }}>{`$${formatMontoCorto(s.precio)}`}</div>
        </div>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.sub }}>{t('precioAConsultar')}</div>
      )}
    </div>
  );
}

// Insignia de estado: un poco mas grande que la original (36px, no 44 — ese
// tamano terminaba empujando el resto de la tarjeta en el ancho real de un
// celular) y sin icono cuando no esta elegido — el circulo vacio ya lee como
// "sin marcar" y evita el "+" ambiguo (¿agregar? ¿sumar?). Elegido se
// codifica de tres formas a la vez (borde de la tarjeta, relleno de fondo y
// este circulo con tilde), nunca solo con color, para que tambien funcione
// con bajo contraste de vision.
function Circulo({ elegido }: { elegido: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 36, height: 36, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: elegido ? colors.primarySolid : colors.surface,
        border: elegido ? 'none' : `2px solid ${colors.muted}`,
      }}
    >
      {elegido && <IcoCheck color={colors.primaryFg} size={16} sw={3} />}
    </span>
  );
}

// Forma del layout real (tira de pastillas de filtro + tarjetas de servicio
// con circulo de estado), para que no salte nada al llegar los servicios.
function ServiciosSkeleton() {
  return (
    <div data-testid="servicios-skeleton">
      <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
        <Hueso w={64} h={30} r={999} />
        <Hueso w={84} h={30} r={999} />
        <Hueso w={72} h={30} r={999} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: GAP_TARJETA, padding: 14, marginBottom: 12 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Hueso w="60%" h={18} />
            <Hueso w="40%" h={14} style={{ marginTop: 10 }} />
          </div>
          <Hueso w={36} h={36} r={18} />
        </div>
      ))}
    </div>
  );
}

// Pantalla 2: seleccion multiple de servicios. Sin total corriente: solo
// "Desde $X" por servicio y una nota de que el valor final se confirma en el negocio.
export function ServiciosScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const listo = useGuardaPaso(slug, 'servicios', ir);
  const { data: servicios, error, cargando, reintentar } = useCarga(
    () => getService().getServices(slug),
    slug,
  );
  const seleccion = useReservaOnlineStore((s) => s.servicioIds);
  const setServicios = useReservaOnlineStore((s) => s.setServicios);

  // Filtro de categoria: 'todos' | id de categoria | 'otros' (sin categoria).
  // Solo cambia lo visible; la seleccion vive en el store y no se toca.
  const [filtro, setFiltro] = useState<'todos' | 'otros' | number>('todos');
  // Promos con mas de 3 pasos que la clienta desplego (solo UI, no se guarda).
  const [desplegadas, setDesplegadas] = useState<Set<number>>(new Set());
  const alternarDesplegada = (id: number) =>
    setDesplegadas((prev) => {
      const sig = new Set(prev);
      if (!sig.delete(id)) sig.add(id);
      return sig;
    });

  // Pista de que la fila de categorias se puede deslizar: un degrade + flecha
  // sutil en el borde derecho, visible solo mientras queda contenido oculto a
  // la derecha (no al llegar al final, ni si todas las pills ya entran).
  const filaRef = useRef<HTMLDivElement>(null);
  const [hayMasCategorias, setHayMasCategorias] = useState(false);
  useEffect(() => {
    const el = filaRef.current;
    if (!el) return;
    const revisar = () => setHayMasCategorias(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    revisar();
    el.addEventListener('scroll', revisar);
    window.addEventListener('resize', revisar);
    return () => {
      el.removeEventListener('scroll', revisar);
      window.removeEventListener('resize', revisar);
    };
  }, [servicios]);

  if (!listo) return null;
  // 404 = el negocio desactivó la reserva online: reintentar no sirve, se avisa.
  if (error?.code === 'not_found') return <NoDisponibleAun variante="negocio" />;

  const categorias = new Map<number, string>();
  for (const s of servicios ?? []) if (s.categoria) categorias.set(s.categoria.id, s.categoria.nombre);
  const hayOtros = (servicios ?? []).some((s) => !s.categoria);
  const hayFiltros = categorias.size > 0;
  const visibles = (servicios ?? []).filter((s) => {
    if (!hayFiltros || filtro === 'todos') return true;
    return filtro === 'otros' ? !s.categoria : s.categoria?.id === filtro;
  });
  const pills: { clave: 'todos' | 'otros' | number; texto: string }[] = [
    { clave: 'todos', texto: t('servicios.filtroTodos') },
    ...[...categorias].map(([id, nombre]) => ({ clave: id, texto: nombre })),
    ...(hayOtros ? [{ clave: 'otros' as const, texto: t('servicios.filtroOtros') }] : []),
  ];

  // Una promo con profesional fija se reserva sola: elegirla suelta lo demas, y
  // elegir otra cosa suelta la promo.
  const esPromoFija = (id: number) => servicios?.find((x) => x.id === id)?.promoComponentizada === true;
  const alternar = (id: number) => {
    if (seleccion.includes(id)) return setServicios(seleccion.filter((x) => x !== id));
    if (esPromoFija(id)) return setServicios([id]);
    setServicios([...seleccion.filter((x) => !esPromoFija(x)), id]);
  };

  return (
    <div>
      <PasoHeader
        titulo={t('servicios.title')}
        subtitulo={t('servicios.subtitle')}
        paso={1}
        onVolver={() => ir(rutaPaso(slug))}
      />
      {error && (
        <>
          <Mensaje tono="error">{t('errores.generico')}</Mensaje>
          <button type="button" onClick={reintentar}>{t('comun.reintentar')}</button>
        </>
      )}
      {cargando && !error && <ServiciosSkeleton />}
      {servicios && servicios.length === 0 && <Mensaje>{t('servicios.vacio')}</Mensaje>}
      {hayFiltros && (
        <div style={{ position: 'relative', marginBottom: 2 }}>
          {/* Scrollbar nativa oculta (Firefox via scrollbarWidth, Chrome/Android
              via el selector de abajo): sin esto, apenas la fila desborda
              aparece la barra del navegador compitiendo con la pista propia
              de "hay mas" — reportado en produccion. */}
          <style>{'[data-fila-categorias]::-webkit-scrollbar { display: none; }'}</style>
          <div
            ref={filaRef}
            data-fila-categorias=""
            role="group"
            aria-label={t('servicios.filtrosAria')}
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}
          >
            {pills.map((p) => {
              const activa = filtro === p.clave;
              return (
                <button
                  key={String(p.clave)}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setFiltro(p.clave)}
                  style={{
                    flexShrink: 0, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                    padding: '8px 16px', borderRadius: 999,
                    background: activa ? colors.strong : colors.surface,
                    color: activa ? colors.surface : colors.strong,
                    border: `1px solid ${activa ? colors.strong : colors.border}`,
                  }}
                >
                  {p.texto}
                </button>
              );
            })}
          </div>
          {/* Pista de "hay mas, desliza": termina justo donde termina esta
              fila (misma columna que las tarjetas), nunca mas alla. */}
          {hayMasCategorias && (
            <div
              data-testid="pista-categorias"
              aria-hidden="true"
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 12, width: 40, pointerEvents: 'none',
                background: `linear-gradient(to right, transparent, ${colors.bg} 75%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: 11, background: colors.bg, border: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={colors.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          )}
        </div>
      )}
      {visibles.map((s) => {
        const elegido = seleccion.includes(s.id);
        const conFotos = s.fotos.length > 0;
        const tarjeta = {
          borderRadius: 16, padding: GAP_TARJETA, marginBottom: 12, width: '100%', boxSizing: 'border-box',
          overflow: 'hidden', cursor: 'pointer',
          background: elegido ? colors.primarySoft : colors.surface,
          border: `${elegido ? 2.5 : 2}px solid ${elegido ? colors.primarySolid : colors.border}`,
        } as const;

        // Una unica regla, siempre: toda la tarjeta selecciona el servicio. El
        // click lo maneja la tarjeta (los botones internos —desplegar pasos,
        // "Ver fotos"— frenan el suyo); el checkbox accesible es el encabezado,
        // que se activa con teclado y burbujea hasta la tarjeta.
        //
        // Sin miniatura: la foto de origen no pasa por ningun recorte al
        // subirla (a diferencia del logo/avatar), asi que forzarla a un
        // cuadrado de 68px con object-fit:cover podia recortarla de forma
        // fea (una cara cortada rara) — reportado en produccion. El link lleva
        // al detalle/visor, donde la foto se ve completa (object-fit:contain).
        return (
          <div key={s.id} style={tarjeta} onClick={() => alternar(s.id)}>
            <button
              type="button"
              role="checkbox"
              aria-checked={elegido}
              aria-label={s.nombre}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: GAP_TARJETA, padding: 0,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <CabeceraServicio s={s} mostrarCategoria={filtro === 'todos'} />
              <Circulo elegido={elegido} />
            </button>
            {s.promoComponentizada && s.componentes && s.componentes.length > 0 && (
              <DetallePromo s={s} expandido={desplegadas.has(s.id)} onToggle={() => alternarDesplegada(s.id)} />
            )}
            <PieServicio s={s} />
            {conFotos && (
              <button
                type="button"
                aria-label={t('servicios.verFotos', { nombre: s.nombre })}
                onClick={(e) => { e.stopPropagation(); ir(rutaServicio(slug, s.id)); }}
                style={{
                  width: `calc(100% + ${GAP_TARJETA * 2}px)`, minHeight: 44, margin: `12px -${GAP_TARJETA}px -${GAP_TARJETA}px`,
                  padding: `0 ${GAP_TARJETA}px`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', textAlign: 'left',
                  background: colors.surface2, border: 'none', borderTop: `1px solid ${colors.hairline}`,
                  fontSize: 13.5, fontWeight: 600, color: colors.primaryDeep,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" />
                </svg>
                <span style={{ flex: 1 }}>{t('servicios.verFotosMuestra', { count: s.fotos.length })}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      <BarraInferior>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: colors.sub, marginBottom: 10, lineHeight: 1.4 }}>
          <IcoBrillo color={colors.primaryDeep} />
          <span>{t('servicios.notaPrecios')}</span>
        </div>
        <BotonPrimario disabled={seleccion.length === 0} onClick={() => ir(rutaPaso(slug, 'horario'))}>
          {seleccion.length > 0
            ? t('servicios.continuar', { count: seleccion.length })
            : t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
