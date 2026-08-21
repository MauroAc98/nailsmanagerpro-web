'use client';

import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { PAISES } from '@/lib/phoneUtils';

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
  onGuardar: () => void;
  guardando: boolean;
  onClose: () => void;
}

import { SheetInput } from './SheetInput';

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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.placeholder, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

export function SheetDatosPersonales({
  nombreEstudio, setNombreEstudio,
  codigoPais, setCodigoPais, telefono, setTelefono, onPasteTelefono,
  direccion, setDireccion,
  onGuardar, guardando, onClose,
}: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
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

      <button
        onClick={onGuardar}
        disabled={guardando}
        style={{
          width: '100%', background: colors.primary, borderRadius: 14, padding: 16,
          border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          opacity: guardando ? 0.6 : 1,
        }}
      >
        {guardando ? t('saving') : t('save')}
      </button>
    </div>
  );
}
