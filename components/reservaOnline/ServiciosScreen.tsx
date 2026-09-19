'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso, rutaServicio } from '@/lib/reservaOnline/rutas';
import { formatMontoCorto } from '@/lib/money';
import type { BookableService } from '@/lib/reservaOnline/types';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { FotoTile } from './FotoTile';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoBrillo, IcoCheck, IcoMas, IcoReloj } from './iconos';
import { BarraInferior, BotonPrimario, Mensaje, PasoHeader } from './ui';

// Datos de la tarjeta: nombre, duracion y "Desde $X" (precio de referencia: el
// valor final lo confirma el salon; el DTO no trae descripcion, asi que no se
// renderiza ninguna linea de descripcion).
function DatosServicio({ s, mostrarCategoria }: { s: BookableService; mostrarCategoria: boolean }) {
  const t = useTranslations('reservaOnline.servicios');
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: colors.textStrong, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {s.nombre}
      </div>
      {mostrarCategoria && s.categoria && (
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{s.categoria.nombre}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 12.5, color: colors.sub }}>
        <IcoReloj color={colors.muted} size={15} />
        <span>{s.duracionMinutos} min</span>
        <span aria-hidden="true" style={{ color: colors.border }}>|</span>
        <b style={{ color: colors.strong, fontWeight: 600 }}>{t('desde', { monto: `$${formatMontoCorto(s.precio)}` })}</b>
      </div>
    </div>
  );
}

// Circulo de estado: check relleno si esta elegido, "+" si no.
function Circulo({ elegido }: { elegido: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 32, height: 32, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: elegido ? colors.primarySolid : colors.surface,
        border: elegido ? 'none' : `1.5px solid ${colors.border}`,
      }}
    >
      {elegido ? <IcoCheck color={colors.primaryFg} size={15} sw={3} /> : <IcoMas color={colors.primaryDeep} sw={2.5} />}
    </span>
  );
}

// Pantalla 2: seleccion multiple de servicios. Sin total corriente: solo
// "Desde $X" por servicio y una nota de que el valor final se confirma en el salon.
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
      {cargando && !error && <Mensaje>{t('comun.cargando')}</Mensaje>}
      {servicios && servicios.length === 0 && <Mensaje>{t('servicios.vacio')}</Mensaje>}
      {hayFiltros && (
        <div
          role="group"
          aria-label={t('servicios.filtrosAria')}
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 2 }}
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
                  flexShrink: 0, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  padding: '7px 14px', borderRadius: 999,
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
        const elegido = seleccion.includes(s.id);
        const tarjeta = {
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
          background: elegido ? colors.primarySoft : colors.surface, borderRadius: 16, padding: '12px 14px 12px 12px',
          marginBottom: 10, border: `${elegido ? 1.5 : 1}px solid ${elegido ? colors.primarySolid : colors.border}`,
        } as const;

        // Sin fotos: la tarjeta entera es el checkbox (sin miniatura).
        if (s.fotos.length === 0) {
          return (
            <button
              key={s.id}
              type="button"
              role="checkbox"
              aria-checked={elegido}
              aria-label={s.nombre}
              onClick={() => alternar(s.id)}
              style={{ ...tarjeta, cursor: 'pointer', textAlign: 'left' }}
            >
              <DatosServicio s={s} mostrarCategoria={filtro === 'todos'} />
              <Circulo elegido={elegido} />
            </button>
          );
        }

        // Con fotos: el cuerpo abre el detalle; el circulo agrega/quita.
        return (
          <div key={s.id} style={tarjeta}>
            <button
              type="button"
              aria-label={t('servicios.verFotos', { nombre: s.nombre })}
              onClick={() => ir(rutaServicio(slug, s.id))}
              style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <FotoTile src={s.fotos[0]} estilo={{ borderRadius: 12 }} />
                <span
                  style={{
                    position: 'absolute', right: 4, bottom: 4, background: 'rgba(43, 34, 38, 0.72)', color: '#fff',
                    fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 6px',
                  }}
                >
                  {t('servicios.fotos', { count: s.fotos.length })}
                </span>
              </div>
              <DatosServicio s={s} mostrarCategoria={filtro === 'todos'} />
            </button>
            <button
              type="button"
              role="checkbox"
              aria-checked={elegido}
              aria-label={s.nombre}
              onClick={() => alternar(s.id)}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}
            >
              <Circulo elegido={elegido} />
            </button>
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
