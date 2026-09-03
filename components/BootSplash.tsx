'use client';

import { useEffect, useState } from 'react';
import { colors, withAlpha } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';

// Splash NEUTRO del arranque — se muestra mientras `authStatus === 'booting'`,
// es decir ANTES de que el chequeo de sesión contra el backend resuelva.
// A diferencia de WelcomeScreen, no afirma nada sobre la sesión: no saluda
// ni muestra el nombre del negocio como texto, solo el logo (si hay) sobre
// el fondo. Por eso es seguro mostrarlo sin haber validado todavía que el
// token siga vivo. El WelcomeScreen personalizado ("Buenos días, {nombre}")
// recién aparece cuando la máquina llega a `authenticated`.
export function BootSplash() {
  const { user } = useAuth();
  const [pulso, setPulso] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPulso(p => !p), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-testid="boot-splash" style={{
      position: 'fixed', inset: 0, zIndex: 150,
      backgroundColor: colors.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-18vh', left: '-35vw',
        width: '100vw', height: '100vw', borderRadius: '50%',
        backgroundColor: withAlpha(colors.primary, '12'),
      }} />

      <div style={{
        position: 'relative',
        opacity: pulso ? 1 : 0.55,
        transition: 'opacity 0.9s ease',
      }}>
        {user?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo que sube cada negocio, sin proporción conocida de antemano; mismo criterio que LoginScreen.
          <img
            src={user.logo_url}
            alt=""
            style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '70vw', maxHeight: 180 }}
          />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: withAlpha(colors.primary, '33'),
          }} />
        )}
      </div>
    </div>
  );
}
