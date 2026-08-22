'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { SheetInput } from './SheetInput';

interface Props {
  password: string;
  setPassword: (v: string) => void;
  passwordConfirmation: string;
  setPasswordConfirmation: (v: string) => void;
  onGuardar: () => void;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function SheetPassword({
  password, setPassword, passwordConfirmation, setPasswordConfirmation,
  onGuardar, guardando, error, onClose,
}: Props) {
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const t = useTranslations('perfil.SheetPassword');

  return (
    <div style={{ padding: '4px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconClose />
        </button>
      </div>

      <SheetInput
        label={t('newPassword')}
        icon={<IconLock />}
        value={password}
        onChange={setPassword}
        placeholder={t('minChars')}
        type={mostrarPassword ? 'text' : 'password'}
        rightAdornment={
          <button
            type="button"
            onClick={() => setMostrarPassword(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <IconEye open={mostrarPassword} />
          </button>
        }
      />

      <SheetInput
        label={t('confirmPassword')}
        icon={<IconLock />}
        value={passwordConfirmation}
        onChange={setPasswordConfirmation}
        placeholder={t('repeatPassword')}
        type="password"
      />

      {error && (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: -8, marginBottom: 16 }}>{error}</p>
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
        {guardando ? t('saving') : t('changePassword')}
      </button>
    </div>
  );
}
