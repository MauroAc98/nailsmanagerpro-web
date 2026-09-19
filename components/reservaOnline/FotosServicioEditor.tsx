'use client';

import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { bytesDeDataUrl, moverFoto, quitarFoto, reducirImagen, TOPE_BYTES_FOTO } from '@/lib/reservaOnline/fotos';
import { MAX_FOTOS_SERVICIO } from '@/lib/reservaOnline/service';
import { agendaColors as colors } from '@/theme/agendaColors';
import { FotoTile } from './FotoTile';
import { useCarga } from './hooks';
import { IcoAtras, IcoMas } from './iconos';
import { Etiqueta, Mensaje } from './ui';

const boton: CSSProperties = {
  width: 26, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
  background: 'rgba(43, 34, 38, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// Editor de las fotos de trabajos de un servicio (lado del salon). La primera
// es la portada; se puede agregar (hasta 12), quitar y reordenar con botones
// izquierda/derecha. Mock: las fotos se guardan como data URLs reducidas en
// localStorage a traves del seam del servicio; el almacenamiento persistente
// requiere un slice de backend.
export function FotosServicioEditor({ servicioId }: { servicioId: number }) {
  const t = useTranslations('reservaOnline.fotos');
  const tc = useTranslations('reservaOnline');
  const { data, error } = useCarga(() => getService().getFotosServicio(servicioId), `fotos|${servicioId}`);
  // `null` = todavia no se toco nada: se muestra lo cargado.
  const [editadas, setEditadas] = useState<string[] | null>(null);
  const [problema, setProblema] = useState<'grande' | 'error' | null>(null);

  if (error) return <Mensaje tono="error">{tc('errores.generico')}</Mensaje>;
  if (!data) return <Mensaje>{tc('comun.cargando')}</Mensaje>;

  const fotos = editadas ?? data;
  const guardar = async (nuevas: string[]) => {
    setEditadas(nuevas);
    try {
      await getService().saveFotosServicio(servicioId, nuevas);
    } catch {
      setProblema('error');
    }
  };

  const agregar = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    setProblema(null);
    let lista = [...fotos];
    for (const archivo of archivos) {
      if (lista.length >= MAX_FOTOS_SERVICIO) break;
      try {
        const dataUrl = await reducirImagen(archivo);
        if (bytesDeDataUrl(dataUrl) > TOPE_BYTES_FOTO) {
          setProblema('grande');
          continue;
        }
        lista = [...lista, dataUrl];
      } catch {
        setProblema('error');
      }
    }
    if (lista.length !== fotos.length) await guardar(lista);
  };

  const lleno = fotos.length >= MAX_FOTOS_SERVICIO;

  return (
    <div>
      <Etiqueta>{t('titulo')}</Etiqueta>
      <div style={{ fontSize: 13, color: colors.sub, lineHeight: 1.45, margin: '-4px 0 12px' }}>{t('ayuda')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {fotos.map((src, i) => (
          <div key={`${i}-${src.slice(-24)}`} data-foto={i} data-src={src} style={{ position: 'relative', height: 104 }}>
            <FotoTile src={src} estilo={{ borderRadius: 14 }} />
            {i === 0 && (
              <span
                style={{
                  position: 'absolute', left: 6, top: 6, background: colors.primarySolid, color: colors.primaryFg,
                  fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 6px',
                }}
              >
                {t('portada')}
              </span>
            )}
            <div style={{ position: 'absolute', left: 4, right: 4, bottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                style={{ ...boton, opacity: i === 0 ? 0.35 : 1 }}
                disabled={i === 0}
                aria-label={t('moverIzquierda', { n: i + 1 })}
                onClick={() => guardar(moverFoto(fotos, i, -1))}
              >
                <IcoAtras color="#fff" size={14} />
              </button>
              <button type="button" style={boton} aria-label={t('quitar', { n: i + 1 })} onClick={() => guardar(quitarFoto(fotos, i))}>
                <span aria-hidden="true" style={{ color: '#fff', fontSize: 16, lineHeight: 1 }}>×</span>
              </button>
              <button
                type="button"
                style={{ ...boton, opacity: i === fotos.length - 1 ? 0.35 : 1 }}
                disabled={i === fotos.length - 1}
                aria-label={t('moverDerecha', { n: i + 1 })}
                onClick={() => guardar(moverFoto(fotos, i, 1))}
              >
                <span style={{ display: 'flex', transform: 'scaleX(-1)' }}>
                  <IcoAtras color="#fff" size={14} />
                </span>
              </button>
            </div>
          </div>
        ))}
        {!lleno && (
          <div
            style={{
              position: 'relative', height: 104, borderRadius: 14, border: `1.5px dashed ${colors.primarySolid}`,
              background: colors.surface2, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, color: colors.primaryDeep, fontSize: 12, fontWeight: 600,
            }}
          >
            <IcoMas color={colors.primaryDeep} sw={2.5} />
            {t('agregar')}
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label={t('agregarAria')}
              onChange={agregar}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
          </div>
        )}
      </div>
      {problema === 'grande' && <Mensaje tono="error">{t('grande')}</Mensaje>}
      {problema === 'error' && <Mensaje tono="error">{tc('errores.generico')}</Mensaje>}
      <div style={{ fontSize: 12, color: colors.sub, marginTop: 12, lineHeight: 1.45 }}>
        {lleno ? t('maximo', { max: MAX_FOTOS_SERVICIO }) : t('nota', { max: MAX_FOTOS_SERVICIO })}
      </div>
    </div>
  );
}
