'use client';

import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { moverFoto } from '@/lib/reservaOnline/fotos';
import { MAX_FOTOS_SERVICIO, servicioService, type FotoServicio } from '@/services/servicioService';
import { agendaColors as colors } from '@/theme/agendaColors';
import { FotoTile } from './FotoTile';
import { useCarga } from './hooks';
import { IcoAtras, IcoMas } from './iconos';
import { Etiqueta, Mensaje } from './ui';

const boton: CSSProperties = {
  width: 26, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
  background: 'rgba(43, 34, 38, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// Mismo limite/copy que valida el backend para este mismo endpoint (5MB,
// image|mimes:jpeg,png,jpg,webp,gif,bmp) — mismo criterio que
// HeroPerfil.MAX_LOGO_BYTES para el logo del negocio. Chequeado sobre el
// archivo ORIGINAL antes de subir, no sobre ninguna reduccion local: a
// diferencia de la vieja implementacion mock (localStorage), el backend
// guarda el archivo tal cual, sin thumbnailing.
const MAX_BYTES_FOTO = 5 * 1024 * 1024;

// Editor de las fotos de trabajos de un servicio (lado del salon, pantalla
// autenticada de Configuracion). La primera es la portada; se puede agregar
// (hasta MAX_FOTOS_SERVICIO), quitar y reordenar con botones izquierda/derecha.
// Rewireado a los endpoints reales via servicioService: cada foto es un item
// direccionable por id (subir de a un archivo, borrar por id, reordenar
// posteando el array completo de ids) — ya no hay un "guardar todo el
// array" como en el viejo mock.
export function FotosServicioEditor({ servicioId }: { servicioId: number }) {
  const t = useTranslations('reservaOnline.fotos');
  const tc = useTranslations('reservaOnline');
  const { data, error } = useCarga(
    () => servicioService.getOne(servicioId).then((s) => s.fotos ?? []),
    `fotos|${servicioId}`,
  );
  // `null` = todavia no se toco nada: se muestra lo cargado.
  const [editadas, setEditadas] = useState<FotoServicio[] | null>(null);
  const [problema, setProblema] = useState<'grande' | 'error' | null>(null);

  if (error) return <Mensaje tono="error">{tc('errores.generico')}</Mensaje>;
  if (!data) return <Mensaje>{tc('comun.cargando')}</Mensaje>;

  const fotos = editadas ?? data;

  const mover = async (indice: number, delta: -1 | 1) => {
    const ids = fotos.map((f) => f.id);
    const nuevosIds = moverFoto(ids, indice, delta);
    if (nuevosIds.every((id, i) => id === ids[i])) return; // extremo: moverFoto no cambio nada
    setProblema(null);
    try {
      const servicio = await servicioService.reordenarFotos(servicioId, nuevosIds);
      setEditadas(servicio.fotos ?? []);
    } catch {
      setProblema('error');
    }
  };

  const quitar = async (fotoId: number) => {
    setProblema(null);
    try {
      const servicio = await servicioService.borrarFoto(servicioId, fotoId);
      setEditadas(servicio.fotos ?? []);
    } catch {
      setProblema('error');
    }
  };

  const agregar = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    setProblema(null);
    let actuales = fotos;
    for (const archivo of archivos) {
      if (actuales.length >= MAX_FOTOS_SERVICIO) break;
      if (archivo.size > MAX_BYTES_FOTO) {
        setProblema('grande');
        continue;
      }
      try {
        const servicio = await servicioService.subirFoto(servicioId, archivo);
        actuales = servicio.fotos ?? [];
        setEditadas(actuales);
      } catch {
        setProblema('error');
      }
    }
  };

  const lleno = fotos.length >= MAX_FOTOS_SERVICIO;

  return (
    <div>
      <Etiqueta>{t('titulo')}</Etiqueta>
      <div style={{ fontSize: 13, color: colors.sub, lineHeight: 1.45, margin: '-4px 0 12px' }}>{t('ayuda')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {fotos.map((foto, i) => (
          <div key={foto.id} data-foto={i} data-src={foto.url} style={{ position: 'relative', height: 104 }}>
            <FotoTile src={foto.url} estilo={{ borderRadius: 14 }} />
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
                onClick={() => mover(i, -1)}
              >
                <IcoAtras color="#fff" size={14} />
              </button>
              <button type="button" style={boton} aria-label={t('quitar', { n: i + 1 })} onClick={() => quitar(foto.id)}>
                <span aria-hidden="true" style={{ color: '#fff', fontSize: 16, lineHeight: 1 }}>×</span>
              </button>
              <button
                type="button"
                style={{ ...boton, opacity: i === fotos.length - 1 ? 0.35 : 1 }}
                disabled={i === fotos.length - 1}
                aria-label={t('moverDerecha', { n: i + 1 })}
                onClick={() => mover(i, 1)}
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
