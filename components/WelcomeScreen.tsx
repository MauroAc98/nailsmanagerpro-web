'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';

function getSaludo(): string {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function WelcomeScreen() {
  const { user, esPrimerLogin, setMostrarBienvenida } = useAuth();
  const [entrada, setEntrada] = useState(false); // fade + slide-up del contenido
  const [progreso, setProgreso] = useState(false); // barra de progreso 0% -> 100%

  const nombre = user?.name?.split(' ')[0] ?? '';

  useEffect(() => {
    // Un tick después del mount para que el navegador registre el estado
    // inicial (opacity:0) antes de animar a los valores finales.
    const raf = requestAnimationFrame(() => {
      setEntrada(true);
      setProgreso(true);
    });

    const timer = setTimeout(() => setMostrarBienvenida(false), 2500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [setMostrarBienvenida]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Círculos decorativos */}
      <div style={{
        position: 'absolute', top: '-18vh', left: '-35vw',
        width: '100vw', height: '100vw', borderRadius: '50%',
        backgroundColor: colors.primary + '15',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10vh', right: '-25vw',
        width: '65vw', height: '65vw', borderRadius: '50%',
        backgroundColor: colors.primary + '0D',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative', textAlign: 'center', padding: '0 40px',
        opacity: entrada ? 1 : 0,
        transform: entrada ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: colors.primary,
          letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 12px',
        }}>
          {getSaludo()}
        </p>
        <p style={{
          fontSize: 42, fontWeight: 700, color: '#2C2C2C', margin: 0,
          fontFamily: '"Times New Roman", Georgia, serif', letterSpacing: 0.5,
        }}>
          {nombre}
        </p>
        <div style={{
          width: 28, height: 2.5, backgroundColor: colors.primary,
          borderRadius: 2, opacity: 0.5, margin: '20px auto',
        }} />
        <p style={{
          fontSize: 15, color: colors.subtext, lineHeight: '24px', letterSpacing: 0.3, margin: 0,
          whiteSpace: 'pre-line',
        }}>
          {esPrimerLogin ? '¡Todo listo para empezar! ✨' : 'Hola de nuevo, qué bueno\nverte otra vez 🌸'}
        </p>
      </div>

      {/* Barra de progreso */}
      <div style={{
        position: 'absolute', bottom: 40, left: 40, right: 40,
        height: 3, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: 3, backgroundColor: colors.primary, borderRadius: 4,
          width: progreso ? '100%' : '0%',
          transition: 'width 2.3s linear',
        }} />
      </div>
    </div>
  );
}
