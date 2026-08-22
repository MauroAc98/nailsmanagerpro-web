'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { colors, shadows, withAlpha } from '@/theme/colors';

export default function CambiarPasswordPage() {
  const t = useTranslations('auth.CambiarPasswordPage');
  const router = useRouter();
  const { cambiarPasswordObligatorio, emailPendiente, loading, error, clearError } = useAuth();

  const [passwordActual, setPasswordActual] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleConfirmar = async () => {
    if (!passwordActual || !password || !passwordConfirmation) return;
    if (password !== passwordConfirmation) return;
    if (password.length < 8) return;
    if (password === passwordActual) return;

    clearError();
    const ok = await cambiarPasswordObligatorio({
      password_actual: passwordActual,
      password,
      password_confirmation: passwordConfirmation,
    });

    if (ok) {
      router.push('/agenda');
    }
  };

  const valido = passwordActual && password && passwordConfirmation && password === passwordConfirmation && password.length >= 8 && password !== passwordActual;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: withAlpha(colors.primary, '22'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 8 }}>
          {t('title')}
        </h2>

        <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.6, margin: 0 }}>
          {t('subtitle')}
          {emailPendiente && (
            <>
              {'\n'}
              <span style={{ fontWeight: 700, color: colors.text }}>{emailPendiente}</span>
            </>
          )}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24, padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 13, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Formulario */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Contraseña provisoria */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            {t('currentPasswordLabel')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showActual ? 'text' : 'password'}
              placeholder={t('currentPasswordPlaceholder')}
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: colors.text,
              }}
            />
            <button
              type="button"
              onClick={() => setShowActual(!showActual)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
                {showActual
                  ? <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </>
                  : <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Nueva contraseña */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            {t('newPasswordLabel')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showNueva ? 'text' : 'password'}
              placeholder={t('newPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: colors.text,
              }}
            />
            <button
              type="button"
              onClick={() => setShowNueva(!showNueva)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
                {showNueva
                  ? <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </>
                  : <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Confirmar contraseña */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            {t('confirmPasswordLabel')}
          </label>
          <input
            type={showNueva ? 'text' : 'password'}
            placeholder={t('confirmPasswordPlaceholder')}
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 12,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.card,
              outline: 'none',
              fontSize: 15,
              color: colors.text,
              padding: '0 16px',
            }}
          />
        </div>

        {/* Validaciones */}
        {password && passwordConfirmation && password !== passwordConfirmation && (
          <p style={{ color: colors.dangerBorder, fontSize: 13, margin: 0, marginTop: -8 }}>
            {t('passwordsDontMatch')}
          </p>
        )}

        {password && password.length < 8 && (
          <p style={{ color: colors.dangerBorder, fontSize: 13, margin: 0, marginTop: -8 }}>
            {t('passwordTooShort')}
          </p>
        )}

        {password && passwordActual && password === passwordActual && (
          <p style={{ color: colors.dangerBorder, fontSize: 13, margin: 0, marginTop: -8 }}>
            {t('samePassword')}
          </p>
        )}

        {/* Botón */}
        <button
          onClick={handleConfirmar}
          disabled={loading || !valido}
          style={{
            height: 52,
            borderRadius: 14,
            backgroundColor: loading || !valido ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: loading || !valido ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            marginTop: 8,
          }}
        >
          {loading ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}
