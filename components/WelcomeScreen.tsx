'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';

export function WelcomeScreen() {
  const t = useTranslations('common.WelcomeScreen');
  const { user, esPrimerLogin, setMostrarBienvenida } = useAuth();
  const [entrada, setEntrada] = useState(false); // fade + slide-up del contenido
  const [progreso, setProgreso] = useState(false); // barra de progreso 0% -> 100%

  const hora = new Date().getHours();
  const saludo = hora >= 6 && hora < 12
    ? t('greetingMorning')
    : hora >= 12 && hora < 20
      ? t('greetingAfternoon')
      : t('greetingEvening');

  // Nombre completo del estudio, no solo la primera palabra — nombres de
  // fantasía como "Beauty studio nails" quedaban cortados a "Beauty". El
  // tamaño baja en escalones para nombres largos, ya no hay límite de una
  // sola línea (es una animación de entrada, no una imagen exportada).
  const nombre = user?.name ?? '';
  const fontSizeNombre = nombre.length > 20 ? 28 : nombre.length > 14 ? 34 : 42;

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
      backgroundColor: colors.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Círculos decorativos */}
      <div style={{
        position: 'absolute', top: '-18vh', left: '-35vw',
        width: '100vw', height: '100vw', borderRadius: '50%',
        backgroundColor: withAlpha(colors.primary, '15'),
      }} />
      <div style={{
        position: 'absolute', bottom: '-10vh', right: '-25vw',
        width: '65vw', height: '65vw', borderRadius: '50%',
        backgroundColor: withAlpha(colors.primary, '0D'),
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
          {saludo}
        </p>
        <p style={{
          fontSize: fontSizeNombre, fontWeight: 700, color: colors.textStrong, margin: 0,
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
          {esPrimerLogin ? t('firstLogin') : t('returning')}
        </p>
      </div>

      {/* Barra de progreso */}
      <div style={{
        position: 'absolute', bottom: 40, left: 40, right: 40,
        height: 3, backgroundColor: colors.surfaceSubtle, borderRadius: 4, overflow: 'hidden',
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
