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
          <a
            href={estado.dataUrl}
            download={`reserva-${nombreArchivoDesdeUrl(url)}.png`}
            style={{
              width: '100%',
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
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            {t('qrDescargar')}
          </a>
        )}
      </div>
    </div>
  );
}
