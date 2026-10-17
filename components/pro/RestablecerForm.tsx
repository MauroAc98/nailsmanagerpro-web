'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { useRutaPro } from '@/hooks/useRutaPro';
import { proErrorDe } from '@/lib/proApi';
import type { ProError } from '@/lib/pro/errores';
import { proService } from '@/services/proService';
import { agendaColors } from '@/theme/agendaColors';
import { CampoPassword } from './CampoPassword';
import { MensajeErrorPro } from './MensajeErrorPro';
import { ProPantallaAuth } from './ProPantallaAuth';
import { useCuentaRegresiva } from './useCuentaRegresiva';

const MIN_CARACTERES = 10;
const LARGO_CODIGO = 6;
const ID_ERROR = 'pro-restablecer-error';
const ID_AYUDA = 'pro-restablecer-ayuda';

type Campo = 'email' | 'nueva' | 'confirmar' | 'general';
type Problema =
  | { campo: Campo; local: 'emailRequerido' | 'corta' | 'noCoincide' }
  | { campo: 'general'; codigoInvalido: true }
  | { campo: Campo; remoto: ProError };

const soloDigitos = (valor: string): string => valor.replace(/\D/g, '').slice(0, LARGO_CODIGO);

// Un fallo del código, del correo o de cualquier otro dato se muestra con UN
// solo mensaje: la pantalla no dice si la cuenta existe ni cuántos intentos
// quedan. Solo un rechazo limitado a la contraseña cae en el copy de validación.
function problemaDe(error: ProError): Problema {
  if (error.kind !== 'validation') return { campo: 'general', remoto: error };
  const campos = Object.keys(error.fields);
  const soloPassword = campos.length > 0 && campos.every((c) => c === 'password' || c === 'password_confirmation');
  return soloPassword ? { campo: 'general', remoto: error } : { campo: 'general', codigoInvalido: true };
}

const estiloLink: CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  color: agendaColors.primaryDeep,
};

// Paso del código + contraseña nueva. NO inicia sesión: al terminar ofrece ir
// al ingreso. El correo y el código pueden llegar en la URL; se leen una vez y
// se sacan de la barra para que no queden en el historial ni viajen en el Referer.
export function RestablecerForm() {
  const t = useTranslations('profesionales.Restablecer');
  const ruta = useRutaPro();
  const params = useSearchParams();
  const [email, setEmail] = useState(() => params.get('email') ?? '');
  const [codigo, setCodigo] = useState(() => soloDigitos(params.get('code') ?? ''));
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [problema, setProblema] = useState<Problema | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<ProError | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const enCurso = useRef(false);
  const montado = useRef(true);
  const restantes = useCuentaRegresiva(errorEnvio);
  const enEspera = restantes !== null && restantes > 0;

  useEffect(() => {
    montado.current = true;
    // Quita query y hash (conserva la ruta) apenas se leyeron los datos.
    if (window.location.search !== '' || window.location.hash !== '') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    return () => {
      montado.current = false;
    };
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current || enEspera || codigo.length !== LARGO_CODIGO) return;
    const correo = email.trim();
    if (correo === '') {
      setErrorEnvio(null);
      setProblema({ campo: 'email', local: 'emailRequerido' });
      return;
    }
    if (nueva.length < MIN_CARACTERES) {
      setErrorEnvio(null);
      setProblema({ campo: 'nueva', local: 'corta' });
      return;
    }
    if (nueva !== confirmacion) {
      setErrorEnvio(null);
      setProblema({ campo: 'confirmar', local: 'noCoincide' });
      return;
    }
    enCurso.current = true;
    setProblema(null);
    setErrorEnvio(null);
    setEnviando(true);
    try {
      await proService.resetPassword({ email: correo, code: codigo, password: nueva, password_confirmation: confirmacion });
      if (montado.current) {
        // Nada de esto se conserva una vez cambiada la contraseña.
        setNueva('');
        setConfirmacion('');
        setCodigo('');
        setListo(true);
      }
    } catch (err) {
      const pro = proErrorDe(err);
      if (montado.current) {
        setProblema(problemaDe(pro));
        setErrorEnvio(pro);
      }
    } finally {
      enCurso.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  if (listo) {
    return (
      <ProPantallaAuth titulo={t('titulo')}>
        <p role="status" style={{ margin: 0, fontSize: 15, color: agendaColors.strong }}>
          {t('exito')}
        </p>
        <Link href={ruta('/login')} style={estiloLink}>
          {t('irAIngresar')}
        </Link>
      </ProPantallaAuth>
    );
  }

  const describe = (campo: Campo) => (problema?.campo === campo ? ID_ERROR : undefined);
  const estiloCampo = (conError: boolean): CSSProperties => ({
    minHeight: 44,
    boxSizing: 'border-box',
    padding: '0 14px',
    fontSize: 16,
    minWidth: 0,
    borderRadius: 12,
    border: `1px solid ${conError ? agendaColors.danger : agendaColors.fieldBorder}`,
    backgroundColor: agendaColors.surface,
    color: agendaColors.strong,
  });
  const estiloEtiqueta: CSSProperties = { fontSize: 14, fontWeight: 600, color: agendaColors.strong };
  const bloqueado = enviando || enEspera || codigo.length !== LARGO_CODIGO;

  return (
    <ProPantallaAuth titulo={t('titulo')}>
      <form onSubmit={enviar} noValidate aria-busy={enviando} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <label htmlFor="pro-restablecer-email" style={estiloEtiqueta}>
            {t('email')}
          </label>
          <input
            id="pro-restablecer-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={enviando}
            aria-invalid={problema?.campo === 'email' ? true : undefined}
            aria-describedby={describe('email')}
            style={estiloCampo(problema?.campo === 'email')}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <label htmlFor="pro-restablecer-codigo" style={estiloEtiqueta}>
            {t('codigo')}
          </label>
          <input
            id="pro-restablecer-codigo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={LARGO_CODIGO}
            value={codigo}
            onChange={(ev) => setCodigo(soloDigitos(ev.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={enviando}
            aria-describedby={ID_AYUDA}
            style={{ ...estiloCampo(false), letterSpacing: 4 }}
          />
          <span id={ID_AYUDA} style={{ fontSize: 13, color: agendaColors.sub }}>
            {t('ayudaCodigo')}
          </span>
        </div>
        <CampoPassword
          id="pro-restablecer-nueva"
          label={t('nueva')}
          value={nueva}
          onChange={setNueva}
          autoComplete="new-password"
          error={problema?.campo === 'nueva'}
          describedBy={describe('nueva')}
          soloLectura={enviando}
        />
        <CampoPassword
          id="pro-restablecer-confirmar"
          label={t('confirmar')}
          value={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
          error={problema?.campo === 'confirmar'}
          describedBy={describe('confirmar')}
          soloLectura={enviando}
        />
        {problema && 'local' in problema && (
          <p id={ID_ERROR} role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
            {t(problema.local)}
          </p>
        )}
        {problema && 'codigoInvalido' in problema && (
          <>
            <p id={ID_ERROR} role="alert" style={{ margin: 0, fontSize: 14, color: agendaColors.danger }}>
              {t('codigoInvalido')}
            </p>
            <Link href={ruta('/olvide-password')} style={estiloLink}>
              {t('reenviar')}
            </Link>
          </>
        )}
        {problema && 'remoto' in problema && <MensajeErrorPro error={problema.remoto} id={ID_ERROR} restantes={restantes} />}
        <button
          type="submit"
          disabled={bloqueado}
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
            cursor: bloqueado ? 'default' : 'pointer',
            opacity: bloqueado ? 0.6 : 1,
            backgroundColor: agendaColors.primarySolid,
            color: agendaColors.primaryFg,
          }}
        >
          {enviando && <Spinner size={18} variante="sobreOscuro" label={t('guardando')} />}
          {enviando ? t('guardando') : t('guardar')}
        </button>
      </form>
    </ProPantallaAuth>
  );
}
