'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { useRutaPro } from '@/hooks/useRutaPro';
import type { ProError } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';
import { CampoPassword } from './CampoPassword';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProPantallaAuth } from './ProPantallaAuth';
import { useCuentaRegresiva } from './useCuentaRegresiva';

const ID_ERROR = 'pro-login-error';

// Ingreso del portal. NO navega: el store deja la sesión en completa o
// restringida y ProGuard lleva a la pantalla que corresponda.
export function LoginProForm() {
  const t = useTranslations('profesionales.LoginPage');
  const ruta = useRutaPro();
  const aviso = useProAuthStore((s) => s.aviso);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ProError | null>(null);
  const [faltanCampos, setFaltanCampos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const montado = useRef(true);
  const restantes = useCuentaRegresiva(error);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const enEspera = restantes !== null && restantes > 0;
  const hayError = faltanCampos || error !== null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current || enEspera) return;
    const correo = email.trim();
    if (correo === '' || password === '') {
      setError(null);
      setFaltanCampos(true);
      return;
    }
    enCurso.current = true;
    setFaltanCampos(false);
    setError(null);
    setEnviando(true);
    try {
      const resultado = await useProAuthStore.getState().login(correo, password);
      if (montado.current) {
        setError(resultado);
        // Solo la contraseña: el correo se conserva para reintentar.
        if (resultado?.kind === 'invalidCredentials') setPassword('');
      }
    } finally {
      enCurso.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  return (
    <ProPantallaAuth titulo={t('titulo')}>
      {aviso !== null && (
        <p
          role="status"
          style={{ margin: 0, padding: 12, borderRadius: 12, fontSize: 14, backgroundColor: agendaColors.amberBg, color: agendaColors.amberFg }}
        >
          {aviso === 'expired' ? t('avisoExpired') : t('avisoRevoked')}
        </p>
      )}
      <form onSubmit={enviar} noValidate aria-busy={enviando} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <label htmlFor="pro-login-email" style={{ fontSize: 14, fontWeight: 600, color: agendaColors.strong }}>
            {t('email')}
          </label>
          <input
            id="pro-login-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={enviando}
            aria-invalid={hayError ? true : undefined}
            aria-describedby={hayError ? ID_ERROR : undefined}
            style={{
              minHeight: 44,
              boxSizing: 'border-box',
              padding: '0 14px',
              fontSize: 16,
              minWidth: 0,
              borderRadius: 12,
              border: `1px solid ${agendaColors.fieldBorder}`,
              backgroundColor: agendaColors.surface,
              color: agendaColors.strong,
            }}
          />
        </div>
        <CampoPassword
          id="pro-login-password"
          label={t('password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={hayError}
          describedBy={hayError ? ID_ERROR : undefined}
          soloLectura={enviando}
        />
        {faltanCampos && (
          <p id={ID_ERROR} role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
            {t('camposRequeridos')}
          </p>
        )}
        {error !== null && <MensajeErrorPro error={error} id={ID_ERROR} restantes={restantes} />}
        <button
          type="submit"
          disabled={enviando || enEspera}
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            cursor: enviando || enEspera ? 'default' : 'pointer',
            opacity: enviando || enEspera ? 0.6 : 1,
            backgroundColor: agendaColors.primarySolid,
            color: agendaColors.primaryFg,
          }}
        >
          {enviando && <Spinner size={18} variante="sobreOscuro" label={t('entrando')} />}
          {enviando ? t('entrando') : t('entrar')}
        </button>
        <Link
          href={ruta('/olvide-password')}
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: agendaColors.primaryDeep,
          }}
        >
          {t('olvide')}
        </Link>
      </form>
    </ProPantallaAuth>
  );
}
