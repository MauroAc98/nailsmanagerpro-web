'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { useRutaPro } from '@/hooks/useRutaPro';
import { proErrorDe } from '@/lib/proApi';
import type { ProError } from '@/lib/pro/errores';
import { proService } from '@/services/proService';
import { agendaColors } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProPantallaAuth } from './ProPantallaAuth';
import { useCuentaRegresiva } from './useCuentaRegresiva';

const ID_ERROR = 'pro-olvide-error';

// Solo estos errores se muestran tal cual: el límite de intentos, el portal
// apagado y la falta de conexión no dicen nada de la cuenta. Cualquier otra
// respuesta (incluidos los 4xx) se trata como enviado, para que la pantalla no
// permita saber si el correo existe.
function seMuestra(error: ProError): boolean {
  return error.kind === 'rateLimited' || error.kind === 'portalUnavailable' || error.kind === 'network';
}

const estiloLink = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  color: agendaColors.primaryDeep,
} as const;

// Pedido del código de recuperación. NO navega: tras enviar ofrece un link al
// paso del código.
export function OlvidePasswordForm() {
  const t = useTranslations('profesionales.OlvidePassword');
  const ruta = useRutaPro();
  const [email, setEmail] = useState('');
  const [faltaEmail, setFaltaEmail] = useState(false);
  const [error, setError] = useState<ProError | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const montado = useRef(true);
  const restantes = useCuentaRegresiva(error);
  const enEspera = restantes !== null && restantes > 0;

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current || enEspera) return;
    const correo = email.trim();
    if (correo === '') {
      setError(null);
      setFaltaEmail(true);
      return;
    }
    enCurso.current = true;
    setFaltaEmail(false);
    setError(null);
    setEnviando(true);
    try {
      await proService.forgotPassword(correo);
      if (montado.current) setEnviado(correo);
    } catch (err) {
      const pro = proErrorDe(err);
      if (!montado.current) return;
      if (seMuestra(pro)) setError(pro);
      else setEnviado(correo);
    } finally {
      enCurso.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  const hayError = faltaEmail || error !== null;

  return (
    <ProPantallaAuth titulo={t('titulo')}>
      {enviado !== null ? (
        <>
          <p role="status" style={{ margin: 0, fontSize: 15, color: agendaColors.strong, overflowWrap: 'anywhere' }}>
            {t('confirmacionGenerica')}
          </p>
          <Link href={`${ruta('/restablecer-password')}?email=${encodeURIComponent(enviado)}`} prefetch={false} style={estiloLink}>
            {t('irACodigo')}
          </Link>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 15, color: agendaColors.sub }}>{t('explicacion')}</p>
          <form onSubmit={enviar} noValidate aria-busy={enviando} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <label htmlFor="pro-olvide-email" style={{ fontSize: 14, fontWeight: 600, color: agendaColors.strong }}>
                {t('email')}
              </label>
              <input
                id="pro-olvide-email"
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
                  border: `1px solid ${hayError ? agendaColors.danger : agendaColors.fieldBorder}`,
                  backgroundColor: agendaColors.surface,
                  color: agendaColors.strong,
                }}
              />
            </div>
            {faltaEmail && (
              <p id={ID_ERROR} role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
                {t('emailRequerido')}
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
              {enviando && <Spinner size={18} variante="sobreOscuro" label={t('enviando')} />}
              {enviando ? t('enviando') : t('enviar')}
            </button>
          </form>
        </>
      )}
      <Link href={ruta('/login')} style={estiloLink}>
        {t('volver')}
      </Link>
    </ProPantallaAuth>
  );
}
