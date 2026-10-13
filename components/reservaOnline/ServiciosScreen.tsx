'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso, rutaServicio } from '@/lib/reservaOnline/rutas';
import { formatMonto } from '@/lib/money';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import type { BookableService } from '@/lib/reservaOnline/types';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import OpcionesSheet from '@/components/cobros/OpcionesSheet';
import { coincide, normalizarBusqueda, partirPorCoincidencia } from '@/lib/reservaOnline/buscarServicios';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoBrillo, IcoCheck, IcoReloj } from './iconos';
import { NoDisponibleAun } from './NoDisponibleAun';
import { EtiquetaPromo, PasosPromo, PastillaModo } from './PromoIncluye';
import { BarraInferior, BotonPrimario, Hueso, Mensaje, PasoHeader } from './ui';

const GAP_TARJETA = 14;

const MAX_PASOS_VISIBLES = 3;

// Hasta cuantas categorias se muestran como pastillas; con mas, un selector.
const MAX_CATEGORIAS_EN_PASTILLAS = 4;

// El buscador por nombre solo aparece con mas servicios que estos: en un negocio
// chico el campo estorbaria y las categorias alcanzan.
const MIN_SERVICIOS_PARA_BUSCAR = 12;

// El nombre con la parte buscada marcada. Sin coincidencia (o sin busqueda) es el
// texto simple de siempre, sin fragmentos.
function nombreMarcado(nombre: string, busqueda: string) {
  const partes = partirPorCoincidencia(nombre, busqueda);
  if (!partes.some((p) => p.coincide)) return nombre;
  return partes.map((f, i) =>
    f.coincide ? (
      <mark key={i} style={{ background: colors.primarySoft, color: 'inherit', borderRadius: 3 }}>{f.texto}</mark>
    ) : (
      <span key={i}>{f.texto}</span>
    ),
  );
}

// Encabezado de la tarjeta: etiqueta PROMO, nombre y categoria. El nombre NUNCA
// se recorta: la clienta decide con el, asi que se parte en las lineas que haga
// falta. Tipografia mas grande que el resto de la app: esta pantalla la usa
// cualquier clienta, incluidas personas mayores, y es la primera decision de
// todo el flujo.
function CabeceraServicio({ s, mostrarCategoria, busqueda = '' }: { s: BookableService; mostrarCategoria: boolean; busqueda?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
      {s.promoComponentizada && <EtiquetaPromo />}
      <div
        style={{
          fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: colors.textStrong, overflowWrap: 'anywhere',
          marginTop: s.promoComponentizada ? 5 : 0,
        }}
      >
        {nombreMarcado(s.nombre, busqueda)}
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
          <div style={{ fontFamily: agendaFontSerif, fontSize: 21, color: colors.strong }}>{`$${formatMonto(s.precio)}`}</div>
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

// Servicio sin ningun turno libre en la ventana reservable: se muestra, pero
// apagado y sin poder elegirse, con el motivo a la vista. Ocultarlo haria creer
// que el negocio no lo ofrece. Es una foto del momento: la autoridad final es el
// hold al reservar.
function TarjetaSinTurnos({ s, mostrarCategoria, busqueda }: { s: BookableService; mostrarCategoria: boolean; busqueda?: string }) {
  const t = useTranslations('reservaOnline.servicios');
  return (
    <div
      data-testid="servicio-sin-turnos"
      aria-disabled="true"
      style={{
        borderRadius: 16, padding: GAP_TARJETA, marginBottom: 12, width: '100%', boxSizing: 'border-box',
        background: colors.surface2, border: `2px dashed ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: GAP_TARJETA, opacity: 0.7 }}>
        <CabeceraServicio s={s} mostrarCategoria={mostrarCategoria} busqueda={busqueda} />
        <span
          aria-hidden="true"
          style={{
            width: 36, height: 36, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: colors.border,
          }}
        >
          <IcoReloj color={colors.muted} size={18} />
        </span>
      </div>
      <div
        style={{
          display: 'inline-block', marginTop: 10, padding: '6px 12px', borderRadius: 999,
          background: colors.amberBg, color: colors.amberFg, fontSize: 13, fontWeight: 600,
        }}
      >
        {t('sinTurnos')}
      </div>
      <div style={{ opacity: 0.7 }}>
        <PieServicio s={s} />
      </div>
    </div>
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
  // `conTurnos`: solo esta pantalla pide que el backend marque los servicios sin
  // turnos (calcular disponibilidad cuesta); el resto de las llamadas no lo manda.
  const { data: servicios, error, cargando, reintentar } = useCarga(
    () => getService().getServices(slug, { conTurnos: true }),
    slug,
  );
  const seleccion = useReservaOnlineStore((s) => s.servicioIds);
  const setServicios = useReservaOnlineStore((s) => s.setServicios);

  // Un servicio elegido antes que ahora no tiene turnos no puede seguir en la
  // seleccion: dejaria la reserva en un callejon sin salida.
  useEffect(() => {
    if (!servicios) return;
    const conservar = seleccion.filter((id) => !servicios.find((s) => s.id === id)?.sinTurnos);
    if (conservar.length !== seleccion.length) setServicios(conservar);
  }, [servicios, seleccion, setServicios]);

  // Filtro de categoria: 'todos' | id de categoria | 'otros' (sin categoria).
  // Solo cambia lo visible; la seleccion vive en el store y no se toca.
  const [filtro, setFiltro] = useState<'todos' | 'otros' | number>('todos');
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  // Promos con mas de 3 pasos que la clienta desplego (solo UI, no se guarda).
  const [desplegadas, setDesplegadas] = useState<Set<number>>(new Set());
  const alternarDesplegada = (id: number) =>
    setDesplegadas((prev) => {
      const sig = new Set(prev);
      if (!sig.delete(id)) sig.add(id);
      return sig;
    });

  if (!listo) return null;
  // 404 = el negocio desactivó la reserva online: reintentar no sirve, se avisa.
  if (error?.code === 'not_found') return <NoDisponibleAun variante="negocio" />;

  const categorias = new Map<number, string>();
  for (const s of servicios ?? []) if (s.categoria) categorias.set(s.categoria.id, s.categoria.nombre);
  const hayOtros = (servicios ?? []).some((s) => !s.categoria);
  const hayFiltros = categorias.size > 0;
  // Buscar por nombre: solo con muchos servicios, y en TODAS las categorias (mientras
  // hay texto el filtro de categoria no se aplica, para no esconder resultados sin
  // que se note).
  const hayBuscador = (servicios ?? []).length > MIN_SERVICIOS_PARA_BUSCAR;
  const buscando = hayBuscador && normalizarBusqueda(busqueda) !== '';
  const visibles = (servicios ?? []).filter((s) => {
    if (buscando) return coincide(s.nombre, busqueda);
    if (!hayFiltros || filtro === 'todos') return true;
    return filtro === 'otros' ? !s.categoria : s.categoria?.id === filtro;
  });
  // Servicios ya elegidos que la busqueda actual no muestra (siguen elegidos).
  const elegidosFuera = buscando ? seleccion.filter((id) => !visibles.some((v) => v.id === id)).length : 0;
  const pills: { clave: 'todos' | 'otros' | number; texto: string }[] = [
    { clave: 'todos', texto: t('servicios.filtroTodos') },
    ...[...categorias].map(([id, nombre]) => ({ clave: id, texto: nombre })),
    ...(hayOtros ? [{ clave: 'otros' as const, texto: t('servicios.filtroOtros') }] : []),
  ];
  // Hasta MAX_CATEGORIAS_EN_PASTILLAS categorias se ven todas como pastillas (en
  // varias lineas si hace falta); con mas, un selector: ocupa una sola linea sin
  // importar cuantas haya y no deja la ultima pastilla cortada en el borde.
  const usarSelector = pills.length - 1 > MAX_CATEGORIAS_EN_PASTILLAS;

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
      {hayBuscador && (
        <>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, boxSizing: 'border-box',
              padding: '0 8px 0 14px', marginBottom: buscando ? 8 : 10, borderRadius: 14, background: colors.surface,
              border: `1px solid ${buscando ? colors.primarySolid : colors.border}`,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.sub} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {/* type="text" + role="searchbox": el campo type="search" trae su propia X nativa y duplicaria la nuestra. */}
            <input
              type="text"
              role="searchbox"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label={t('servicios.buscarAria')}
              placeholder={t('servicios.buscarPlaceholder')}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0,
                fontSize: 16, fontFamily: 'inherit', color: colors.text,
              }}
            />
            {busqueda && (
              <button
                type="button"
                aria-label={t('servicios.borrarTexto')}
                onClick={() => setBusqueda('')}
                style={{
                  width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.sub} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {buscando && visibles.length > 0 && (
            <p style={{ margin: '0 0 10px', fontSize: 12.5, color: colors.sub }}>
              {t('servicios.resultadosBusqueda', { count: visibles.length })}
            </p>
          )}
          {buscando && visibles.length === 0 && (
            <div style={{ padding: '32px 16px', marginBottom: 12, borderRadius: 16, textAlign: 'center', background: colors.surface, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.strong, marginBottom: 6 }}>
                {t('servicios.sinResultados', { q: busqueda.trim() })}
              </div>
              <div style={{ fontSize: 14, color: colors.sub, lineHeight: 1.5, marginBottom: 16 }}>{t('servicios.sinResultadosAyuda')}</div>
              <button
                type="button"
                onClick={() => setBusqueda('')}
                style={{
                  minHeight: 46, padding: '0 20px', borderRadius: 12, cursor: 'pointer', background: 'transparent',
                  border: `1px solid ${colors.primarySolid}`, color: colors.primaryDeep, fontSize: 15, fontWeight: 700,
                }}
              >
                {t('servicios.borrarBusqueda')}
              </button>
            </div>
          )}
        </>
      )}
      {hayFiltros && !buscando && usarSelector && (
        // Hoja inferior (la misma de Cobros) y no un <select> nativo: el desplegable
        // del navegador no respeta el modo oscuro (salia blanco con letras claras).
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSelectorAbierto(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, boxSizing: 'border-box',
              padding: '0 16px', marginBottom: 14, borderRadius: 14, cursor: 'pointer', fontSize: 15,
              background: colors.surface, border: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ color: colors.sub, flexShrink: 0 }}>{t('servicios.categoriaEtiqueta')}</span>
            <span
              style={{
                flex: 1, minWidth: 0, textAlign: 'right', fontWeight: 700, color: colors.strong,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {pills.find((p) => p.clave === filtro)?.texto}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <OpcionesSheet
            visible={selectorAbierto}
            titulo={t('servicios.categoriaEtiqueta')}
            valor={String(filtro)}
            opciones={pills.map((p) => ({ valor: String(p.clave), texto: p.texto }))}
            onElegir={(v) => {
              setFiltro(pills.find((p) => String(p.clave) === v)?.clave ?? 'todos');
              setSelectorAbierto(false);
            }}
            onCerrar={() => setSelectorAbierto(false)}
          />
        </>
      )}
      {hayFiltros && !buscando && !usarSelector && (
        <div
          role="group"
          aria-label={t('servicios.filtrosAria')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 14 }}
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
                  maxWidth: '100%', overflowWrap: 'anywhere', textAlign: 'center', cursor: 'pointer', fontSize: 14,
                  fontWeight: 600, minHeight: 40, padding: '8px 16px', borderRadius: 999,
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
      )}
      {visibles.map((s) => {
        if (s.sinTurnos) {
          return <TarjetaSinTurnos key={s.id} s={s} mostrarCategoria={filtro === 'todos' || buscando} busqueda={buscando ? busqueda : ''} />;
        }
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
              <CabeceraServicio s={s} mostrarCategoria={filtro === 'todos' || buscando} busqueda={buscando ? busqueda : ''} />
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
        {elegidosFuera > 0 && (
          <div role="status" style={{ textAlign: 'center', fontSize: 12.5, color: colors.sub, marginBottom: 8 }}>
            {t('servicios.elegidosFuera', { count: elegidosFuera })}
          </div>
        )}
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
