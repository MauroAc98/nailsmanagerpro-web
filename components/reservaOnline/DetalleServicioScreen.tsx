'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { FotoTile } from './FotoTile';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoAtras, IcoReloj } from './iconos';
import { BarraInferior, BotonPrimario, Hueso, Mensaje } from './ui';

// Forma del layout real (galeria + titulo/duracion + boton), para que no
// salte nada al llegar el servicio.
function DetalleServicioSkeleton() {
  return (
    <div data-testid="detalle-servicio-skeleton">
      <Hueso w="calc(100% + 40px)" h={250} r={0} style={{ margin: '-16px -20px 0' }} />
      <div style={{ padding: '16px 0 0' }}>
        <Hueso w="65%" h={26} />
        <Hueso w="45%" h={14} style={{ marginTop: 10 }} />
        <Hueso w="90%" h={13} style={{ marginTop: 12 }} />
      </div>
      <BarraInferior>
        <Hueso w="100%" h={52} r={14} />
      </BarraInferior>
    </div>
  );
}

// Detalle de un servicio: galeria paginada (deslizable) con miniaturas, datos
// y "Agregar a mi turno". El precio es solo de referencia ("Desde"): el valor
// final lo confirma el salon. Sin descripcion en el DTO no se inventa una.
export function DetalleServicioScreen({
  slug,
  servicioId,
  ir,
}: {
  slug: string;
  servicioId: number;
  ir: Ir;
}) {
  const t = useTranslations('reservaOnline');
  const listo = useGuardaPaso(slug, 'servicios', ir);
  const { data: servicios, error } = useCarga(() => getService().getServices(slug), slug);
  const seleccion = useReservaOnlineStore((s) => s.servicioIds);
  const setServicios = useReservaOnlineStore((s) => s.setServicios);
  const [indice, setIndice] = useState(0);
  const galeria = useRef<HTMLDivElement>(null);

  if (!listo) return null;
  const volver = () => ir(rutaPaso(slug, 'servicios'));

  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!servicios) return <DetalleServicioSkeleton />;
  const s = servicios.find((x) => x.id === servicioId);
  if (!s) return <Mensaje tono="error">{t('detalle.noEncontrado')}</Mensaje>;

  const elegido = seleccion.includes(s.id);
  const fotos = s.fotos;

  const irAFoto = (i: number) => {
    setIndice(i);
    const el = galeria.current;
    // scrollTo no existe en todos los entornos (jsdom): el estado ya cambio.
    el?.scrollTo?.({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  const alScroll = () => {
    const el = galeria.current;
    if (el && el.clientWidth > 0) setIndice(Math.round(el.scrollLeft / el.clientWidth));
  };

  const alternar = () => {
    setServicios(elegido ? seleccion.filter((x) => x !== s.id) : [...seleccion, s.id]);
    volver();
  };

  return (
    <div>
      <div style={{ position: 'relative', margin: '-16px -20px 0', height: 250, background: colors.surface2 }}>
        <div
          ref={galeria}
          onScroll={alScroll}
          style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {fotos.map((f, i) => (
            <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start' }}>
              <FotoTile src={f} iconoTam={40} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={volver}
          aria-label={t('comun.volver')}
          style={{
            position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, border: 'none', padding: 0,
            background: 'rgba(255, 255, 255, 0.92)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IcoAtras color="#2b2226" size={22} />
        </button>
        {fotos.length > 0 && (
          <div
            style={{
              position: 'absolute', right: 14, bottom: 12, background: 'rgba(43, 34, 38, 0.72)', color: '#fff',
              fontSize: 12, fontWeight: 600, borderRadius: 12, padding: '3px 10px',
            }}
          >
            {t('detalle.contador', { actual: indice + 1, total: fotos.length })}
          </div>
        )}
      </div>

      {fotos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 0 0', overflowX: 'auto' }}>
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              aria-label={t('detalle.verFoto', { n: i + 1 })}
              aria-current={i === indice ? 'true' : undefined}
              onClick={() => irAFoto(i)}
              style={{
                width: 56, height: 56, flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                borderRadius: 12, overflow: 'hidden',
                boxShadow: i === indice ? `0 0 0 2px ${colors.primarySolid}` : undefined,
              }}
            >
              <FotoTile src={f} />
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '16px 0 0' }}>
        <h1 style={{ margin: 0, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, color: colors.textStrong }}>
          {s.nombre}
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 13.5, color: colors.sub }}>
          <IcoReloj color={colors.muted} size={15} />
          <span>{s.duracionMinutos} min</span>
          <span aria-hidden="true" style={{ color: colors.border }}>|</span>
          <b style={{ color: colors.strong }}>{t('servicios.desde', { monto: `$${formatMontoCorto(s.precio)}` })}</b>
        </div>
        <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 10, lineHeight: 1.45 }}>{t('detalle.notaValor')}</div>
      </div>

      <BarraInferior>
        <BotonPrimario onClick={alternar}>{elegido ? t('detalle.quitar') : t('detalle.agregar')}</BotonPrimario>
      </BarraInferior>
    </div>
  );
}
