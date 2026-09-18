'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Locate, Pencil, Trash2 } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { PAISES } from '@/lib/phoneUtils';
import { esUbicacionValida } from '@/lib/ubicacion';
import { urlMapaEstatico } from '@/lib/mapaEstatico';
import { obtenerGps } from '@/lib/obtenerGps';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface Props {
  nombreEstudio: string;
  setNombreEstudio: (v: string) => void;
  codigoPais: string;
  setCodigoPais: (v: string) => void;
  telefono: string;
  setTelefono: (v: string) => void;
  onPasteTelefono: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  // Ubicación (Slice A) — el "Confirmar" del modal solo actualiza este
  // estado local del sheet, igual que `direccion`: el "Guardar" de abajo
  // sigue siendo el único disparador de `updatePerfil` (design D4).
  latitud: number | null;
  longitud: number | null;
  setUbicacion: (lat: number, lng: number) => void;
  // Quita la ubicación (vuelve a null/null en el estado local del sheet); el
  // caller decide si confirma antes — el guardado sigue siendo el de abajo.
  onQuitarUbicacion: () => void;
  // 422 del backend en `latitud` (todos los errores de coordenadas se
  // devuelven bajo esa key, ver apply-progress de A1) — se muestra junto al
  // campo, nunca como diálogo genérico.
  errorUbicacion?: string | null;
  onGuardar: () => void;
  guardando: boolean;
  onClose: () => void;
}

import { SheetInput } from './SheetInput';
import { UbicacionMapaModal } from './UbicacionMapaModal';

function IconStore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const accionUbicacionStyle: React.CSSProperties = {
  flex: 1, height: 42, borderRadius: 12, border: `1px solid ${colors.border}`,
  backgroundColor: colors.surface, color: colors.primaryDeep,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.placeholder, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

export function SheetDatosPersonales({
  nombreEstudio, setNombreEstudio,
  codigoPais, setCodigoPais, telefono, setTelefono, onPasteTelefono,
  direccion, setDireccion,
  latitud, longitud, setUbicacion, onQuitarUbicacion, errorUbicacion,
  onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [errorGps, setErrorGps] = useState(false);
  const ubicacionCargada = esUbicacionValida(latitud, longitud);
  // Vista previa: si la imagen falla (sin red, key inválida) se oculta esa URL
  // puntual en vez de dejar un ícono de imagen rota; una ubicación nueva
  // genera otra URL y vuelve a intentar.
  const [urlFallida, setUrlFallida] = useState<string | null>(null);
  const urlVistaPrevia = ubicacionCargada
    ? urlMapaEstatico(latitud as number, longitud as number, process.env.NEXT_PUBLIC_LOCATIONIQ_KEY)
    : null;

  // Cargar por GPS sin necesitar abrir el mapa (feedback de usuario: quería
  // "ubicarlo por GPS previamente, antes de abrir [el mapa]" — este botón
  // hace exactamente eso; el mapa queda para cuando se quiere ajustar el pin
  // a mano o el GPS no da una posición precisa). Mismo `obtenerGps()` que usa
  // `MapaPicker`, misma disciplina de "nunca tira, nunca bloquea".
  // `withGlobalLoader` (mismo spinner de pantalla completa que login/guardar)
  // porque el botón solo, sin bloquear nada, pasaba desapercibido — un GPS
  // sin buena señal puede tardar varios segundos y el usuario no tenía
  // ninguna señal de que algo estaba pasando.
  const usarGpsDirecto = async () => {
    if (buscandoGps) return;
    setBuscandoGps(true);
    setErrorGps(false);
    try {
      const resultado = await withGlobalLoader(() => obtenerGps());
      if (!resultado) {
        setErrorGps(true);
        return;
      }
      setUbicacion(resultado.lat, resultado.lon);
    } finally {
      setBuscandoGps(false);
    }
  };

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      <SheetInput label={t('studioName')} icon={<IconStore />} value={nombreEstudio} onChange={setNombreEstudio} placeholder={t('studioName')} />

      <div style={{ marginBottom: 16, width: '100%', boxSizing: 'border-box' }}>
        <p style={sectionLabelStyle}>{t('phone')}</p>
        <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          <select
            value={codigoPais}
            onChange={e => setCodigoPais(e.target.value)}
            style={{
              backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 12,
              padding: '12px 8px', fontSize: 14, color: colors.text,
              outline: 'none', cursor: 'pointer', flexShrink: 0,
              width: 90, maxWidth: 90, boxSizing: 'border-box',
            }}
          >
            {PAISES.map(p => (
              <option key={p.codigo} value={p.codigo}>{p.label}</option>
            ))}
          </select>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
            backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 12,
            padding: '12px 14px', boxSizing: 'border-box',
          }}>
            <IconPhone />
            <input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              onPaste={onPasteTelefono}
              placeholder={t('phone')}
              type="tel"
              inputMode="tel"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={sectionLabelStyle}>{t('address')}</p>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`, borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ marginTop: 2 }}><IconMapPin /></div>
          <textarea
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder={t('address')}
            rows={2}
            style={{
              flex: 1, border: 'none', background: 'none', outline: 'none', resize: 'vertical',
              fontSize: 15, color: colors.text, minWidth: 0, minHeight: 44, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={sectionLabelStyle}>{t('locationSection')}</p>

        {!ubicacionCargada ? (
          <div style={{
            border: `1.5px dashed ${colors.border}`, borderRadius: 16, backgroundColor: colors.surfaceSubtle,
            padding: '22px 18px 18px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 6,
          }}>
            <span style={{
              width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <p style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 700, color: colors.textStrong }}>
              {t('locationEmptyTitle')}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, color: colors.subtext }}>
              {t('locationEmptyHint')}
            </p>
            <button
              type="button"
              onClick={() => setMapaAbierto(true)}
              style={{
                width: '100%', height: 46, border: 'none', borderRadius: 12,
                backgroundColor: colors.primarySolid, color: colors.primaryFg,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {t('locationSet')}
            </button>
            <button
              type="button"
              onClick={usarGpsDirecto}
              disabled={buscandoGps}
              style={{
                width: '100%', height: 44, border: `1px solid ${colors.border}`, borderRadius: 12,
                backgroundColor: colors.surface, color: colors.primaryDeep,
                fontSize: 14, fontWeight: 700, cursor: buscandoGps ? 'default' : 'pointer',
                opacity: buscandoGps ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Locate size={17} color={colors.primaryDeep} />
              {t('locationUseCurrent')}
            </button>
          </div>
        ) : (
          <div style={{
            border: `1px solid ${colors.border}`, borderRadius: 16, backgroundColor: colors.surface,
            boxShadow: shadows.card, overflow: 'hidden',
          }}>
            {urlVistaPrevia && urlVistaPrevia !== urlFallida && (
              // eslint-disable-next-line @next/next/no-img-element -- mapa estático externo (LocationIQ), no un asset optimizable
              <img
                src={urlVistaPrevia}
                alt={t('locationPreviewAlt')}
                onError={() => setUrlFallida(urlVistaPrevia)}
                style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover', backgroundColor: colors.surfaceSubtle }}
              />
            )}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 10, backgroundColor: colors.successBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong }}>{t('locationMarked')}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
              <button
                type="button"
                onClick={() => setMapaAbierto(true)}
                style={accionUbicacionStyle}
              >
                <Pencil size={15} color={colors.primaryDeep} />
                {t('locationMovePin')}
              </button>
              <button
                type="button"
                onClick={usarGpsDirecto}
                disabled={buscandoGps}
                style={{ ...accionUbicacionStyle, opacity: buscandoGps ? 0.6 : 1, cursor: buscandoGps ? 'default' : 'pointer' }}
              >
                <Locate size={15} color={colors.primaryDeep} />
                {t('locationUseGpsShort')}
              </button>
              <button
                type="button"
                onClick={onQuitarUbicacion}
                aria-label={t('locationRemove')}
                style={{
                  width: 42, height: 42, flexShrink: 0, borderRadius: 12,
                  border: `1px solid ${colors.dangerBorder}`, backgroundColor: colors.dangerBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Trash2 size={17} color={colors.danger} />
              </button>
            </div>
          </div>
        )}
      </div>

      {errorGps && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16 }}>{t('mapUseGpsFailed')}</p>
      )}

      {errorUbicacion && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16 }}>{errorUbicacion}</p>
      )}

      <button
        onClick={onGuardar}
        disabled={guardando}
        style={{
          width: '100%', background: colors.primarySolid, borderRadius: 14, padding: 16,
          border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          opacity: guardando ? 0.6 : 1,
        }}
      >
        {guardando ? t('saving') : t('save')}
      </button>

      {mapaAbierto && (
        <UbicacionMapaModal
          latitud={latitud}
          longitud={longitud}
          onCancelar={() => setMapaAbierto(false)}
          onConfirmar={(lat, lng) => {
            setUbicacion(lat, lng);
            setMapaAbierto(false);
          }}
        />
      )}
    </div>
  );
}
