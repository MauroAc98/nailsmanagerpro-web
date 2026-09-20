'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';
import { linkReservaCorto } from '@/lib/reservaOnline/linkPublico';
import { generarQrDataUrl } from '@/lib/reservaOnline/qr';

// Encima de todo lo demas en la app, mismo nivel que VisorFotos/LogoCropModal
// (modal disparado por una accion explicita del usuario) — nunca deberia
// quedar tapado por un sheet/toast/confirm.
const Z_INDEX = 200;

type Estado = { tipo: 'cargando' } | { tipo: 'listo'; dataUrl: string } | { tipo: 'error' };

// El slug del salon (ultimo segmento del link) — cada duena descarga SU QR,
// identificable, en vez de un nombre generico de la app para todas.
function nombreArchivoDesdeUrl(url: string): string {
  const segmentos = url.split('/').filter(Boolean);
  return segmentos[segmentos.length - 1] ?? 'link';
}

// Decodifica a mano en vez de `fetch(dataUrl)`: Safari historicamente no
// soporta bien fetch() sobre `data:` URLs, y esto evita depender de eso.
function dataUrlABlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Modal del codigo QR del link publico de reserva. Genera el QR de forma
// perezosa (solo mientras este modal esta montado, nunca desde LinkCompartir
// de forma eager) y lo muestra sobre una tarjeta blanca explicita — el QR
// necesita fondo claro para escanear bien sin importar si la app esta en
// modo oscuro.
export function QrLinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useTranslations('reservaOnline.settings');
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [intento, setIntento] = useState(0);

  // El "cargando" inicial ya lo cubre el useState de arriba; reintentar pone
  // el estado en "cargando" desde el propio handler del boton (no desde el
  // efecto, para no hacer un setState sincrono al arrancar el efecto) y
  // dispara una nueva corrida cambiando `intento`.
  const reintentar = () => {
    setEstado({ tipo: 'cargando' });
    setIntento((n) => n + 1);
  };

  // Mismo patron que compartirImagen (useGenerarHistoria.ts): Web Share API
  // con el archivo real cuando el navegador la soporta; cancelar el share
  // nativo (AbortError) no es un error, se ignora en silencio. Sin soporte
  // (desktop, navegadores viejos), cae al mismo comportamiento que Descargar.
  const compartir = async () => {
    if (estado.tipo !== 'listo') return;
    const nombreArchivo = `reserva-${nombreArchivoDesdeUrl(url)}.png`;
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare) {
      const file = new File([dataUrlABlob(estado.dataUrl)], nombreArchivo, { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file] });
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('QrLinkModal: compartir fallo', err);
          }
        }
        return;
      }
    }
    const a = document.createElement('a');
    a.href = estado.dataUrl;
    a.download = nombreArchivo;
    a.click();
  };

  useEffect(() => {
    let cancelado = false;
    generarQrDataUrl(url)
      .then((dataUrl) => {
        if (!cancelado) setEstado({ tipo: 'listo', dataUrl });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: 'error' });
      });
    return () => {
      cancelado = true;
    };
  }, [url, intento]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 340,
          borderRadius: 16,
          background: colors.surface,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.strong }}>{t('qrTitulo')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('qrCerrarAria')}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              border: 'none',
              background: colors.surface2,
              color: colors.text,
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Tarjeta blanca explicita: el QR debe quedar sobre fondo claro
            plano para escanear de forma confiable, sin depender de que
            colors.surface sea claro (no lo es en modo oscuro). */}
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 10,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {estado.tipo === 'cargando' && (
            <span style={{ fontSize: 13, color: '#00000099' }}>{t('qrGenerando')}</span>
          )}
          {estado.tipo === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 16 }}>
              <span style={{ fontSize: 13, color: '#000000CC', textAlign: 'center' }}>{t('qrError')}</span>
              <button
                type="button"
                onClick={reintentar}
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.primaryDeep,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('qrReintentar')}
              </button>
            </div>
          )}
          {estado.tipo === 'listo' && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL local, no aplica next/image
            <img src={estado.dataUrl} alt={t('qrTitulo')} width={280} height={280} />
          )}
        </div>

        <span style={{ fontSize: 12.5, color: colors.sub, wordBreak: 'break-all', textAlign: 'center' }}>
          {linkReservaCorto(url)}
        </span>

        {estado.tipo === 'listo' && (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={compartir}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: colors.primarySolid,
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {t('qrCompartir')}
            </button>
            <a
              href={estado.dataUrl}
              download={`reserva-${nombreArchivoDesdeUrl(url)}.png`}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.strong,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.strong} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('qrDescargar')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
