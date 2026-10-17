'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import type { ProError } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';
import { CampoPassword } from './CampoPassword';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProPantallaAuth } from './ProPantallaAuth';

const MIN_CARACTERES = 10;
const ID_ERROR = 'pro-cambiar-error';

type Campo = 'nueva' | 'confirmar' | 'general';
type Problema = { campo: Campo; local: 'corta' | 'noCoincide' } | { campo: Campo; remoto: ProError };

// Con `validation` del servidor el error se ata al campo que lo mencionó.
function campoDe(error: ProError): Campo {
  if (error.kind !== 'validation') return 'general';
  return 'password_confirmation' in error.fields && !('password' in error.fields) ? 'confirmar' : 'nueva';
}

// Cambio forzado de contraseña. NO navega: al guardar, el store deja la sesión
// completa (o la cierra si se revocó) y ProGuard lleva a la pantalla que sigue.
export function CambiarPasswordProForm() {
  const t = useTranslations('profesionales.CambiarPassword');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [problema, setProblema] = useState<Problema | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current) return;
    if (nueva.length < MIN_CARACTERES) {
      setProblema({ campo: 'nueva', local: 'corta' });
      return;
    }
    if (nueva !== confirmacion) {
      setProblema({ campo: 'confirmar', local: 'noCoincide' });
      return;
    }
    enCurso.current = true;
    setProblema(null);
    setGuardando(true);
    try {
      const resultado = await useProAuthStore.getState().cambiarPassword(nueva, confirmacion);
      // sessionRevoked: no hay nada propio que mostrar, el guard lleva al ingreso.
      if (montado.current && resultado !== null && resultado.kind !== 'sessionRevoked') {
        setProblema({ campo: campoDe(resultado), remoto: resultado });
      }
    } finally {
      enCurso.current = false;
      if (montado.current) setGuardando(false);
    }
  }

  const describe = (campo: Campo) => (problema?.campo === campo ? ID_ERROR : undefined);

  return (
    <ProPantallaAuth titulo={t('titulo')}>
      <p style={{ margin: 0, fontSize: 15, color: agendaColors.sub }}>{t('explicacion')}</p>
      <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CampoPassword
          id="pro-cambiar-nueva"
          label={t('nueva')}
          value={nueva}
          onChange={setNueva}
          autoComplete="new-password"
          error={problema?.campo === 'nueva'}
          describedBy={describe('nueva')}
          disabled={guardando}
        />
        <CampoPassword
          id="pro-cambiar-confirmar"
          label={t('confirmar')}
          value={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
          error={problema?.campo === 'confirmar'}
          describedBy={describe('confirmar')}
          disabled={guardando}
        />
        {problema && 'local' in problema && (
          <p id={ID_ERROR} role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
            {t(problema.local)}
          </p>
        )}
        {problema && 'remoto' in problema && <MensajeErrorPro error={problema.remoto} id={ID_ERROR} />}
        <button
          type="submit"
          disabled={guardando}
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
            cursor: guardando ? 'default' : 'pointer',
            opacity: guardando ? 0.6 : 1,
            backgroundColor: agendaColors.primarySolid,
            color: agendaColors.primaryFg,
          }}
        >
          {guardando && <Spinner size={18} variante="sobreOscuro" label={t('guardando')} />}
          {guardando ? t('guardando') : t('guardar')}
        </button>
        <button
          type="button"
          onClick={() => void useProAuthStore.getState().logout()}
          style={{
            minHeight: 44,
            border: `1px solid ${agendaColors.border}`,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: agendaColors.sub,
          }}
        >
          {t('cerrarSesion')}
        </button>
      </form>
    </ProPantallaAuth>
  );
}
