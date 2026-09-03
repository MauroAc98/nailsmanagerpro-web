'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { colors, withAlpha } from '@/theme/colors';

// Splash NEUTRO del arranque — se muestra mientras `authStatus === 'booting'`,
// es decir ANTES de que el chequeo de sesión contra el backend resuelva.
// A diferencia de WelcomeScreen, no afirma nada sobre la sesión: solo la
// marca de Turnetto, la misma que ve el usuario al abrir la PWA instalada
// (apple-touch-startup-image, ver app/layout.tsx). Por eso es seguro
// mostrarlo sin haber validado todavía que el token siga vivo. El
// WelcomeScreen personalizado ("Buenos días, {nombre}") recién aparece
// cuando la máquina llega a `authenticated`.
export function BootSplash() {
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

      <Image
        src="/icon-192.png"
        alt=""
        width={80}
        height={80}
        priority
        style={{
          borderRadius: 20,
          opacity: pulso ? 1 : 0.5,
          transition: 'opacity 0.9s ease',
        }}
      />
    </div>
  );
}
