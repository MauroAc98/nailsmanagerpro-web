'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso, rutaServicio } from '@/lib/reservaOnline/rutas';
import { formatMontoCorto } from '@/lib/money';
import type { BookableService } from '@/lib/reservaOnline/types';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { FotoTile } from './FotoTile';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoBrillo, IcoCheck, IcoReloj } from './iconos';
import { BarraInferior, BotonPrimario, Hueso, Mensaje, PasoHeader } from './ui';

// Ancho de la miniatura + separacion: el link "Ver fotos" (fuera del boton de
// seleccion, ver mas abajo) se indenta este mismo valor para quedar alineado
// debajo del nombre en vez de debajo de la foto.
const ANCHO_MINIATURA = 68;
const GAP_TARJETA = 14;

// Datos de la tarjeta: nombre, duracion y "Desde $X" (precio de referencia: el
// valor final lo confirma el negocio; el DTO no trae descripcion, asi que no
// se renderiza ninguna linea de descripcion). Tipografia mas grande que el
// resto de la app: esta pantalla la usa cualquier clienta, incluidas
// personas mayores, y es la primera decision de todo el flujo.
function DatosServicio({ s, mostrarCategoria }: { s: BookableService; mostrarCategoria: boolean }) {
  const t = useTranslations('reservaOnline.servicios');
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: colors.textStrong, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {s.nombre}
      </div>
      {mostrarCategoria && s.categoria && (
        <div style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{s.categoria.nombre}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 7, fontSize: 13.5, color: colors.sub }}>
        <IcoReloj color={colors.muted} size={15} />
        <span>{s.duracionMinutos} min</span>
        <span aria-hidden="true" style={{ color: colors.border }}>|</span>
        <b style={{ color: colors.strong, fontWeight: 600 }}>{t('desde', { monto: `$${formatMontoCorto(s.precio)}` })}</b>
      </div>
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

  const alternar = (id: number) =>
    setServicios(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);

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
          <div
            ref={filaRef}
            role="group"
            aria-label={t('servicios.filtrosAria')}
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}
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
          background: elegido ? colors.primarySoft : colors.surface,
          border: `${elegido ? 2.5 : 2}px solid ${elegido ? colors.primarySolid : colors.border}`,
        } as const;

        // Una unica regla, siempre: toda la tarjeta selecciona el servicio.
        // "Ver fotos" (cuando hay) es un link aparte, chico y con texto propio,
        // en vez de compartir la zona de toque con la seleccion.
        return (
          <div key={s.id} style={tarjeta}>
            <button
              type="button"
              role="checkbox"
              aria-checked={elegido}
              aria-label={s.nombre}
              onClick={() => alternar(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: GAP_TARJETA, padding: 0,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {conFotos && (
                <div style={{ width: ANCHO_MINIATURA, height: ANCHO_MINIATURA, flexShrink: 0 }}>
                  <FotoTile src={s.fotos[0]} estilo={{ borderRadius: 12 }} />
                </div>
              )}
              <DatosServicio s={s} mostrarCategoria={filtro === 'todos'} />
              <Circulo elegido={elegido} />
            </button>
            {conFotos && (
              <button
                type="button"
                aria-label={t('servicios.verFotos', { nombre: s.nombre })}
                onClick={() => ir(rutaServicio(slug, s.id))}
                style={{
                  display: 'block', marginTop: 8, marginLeft: ANCHO_MINIATURA + GAP_TARJETA, padding: 0,
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontWeight: 600, color: colors.primaryDeep, textDecoration: 'underline',
                }}
              >
                {t('servicios.verNFotos', { count: s.fotos.length })}
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
