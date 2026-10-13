'use client';

import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { setTheme, useThemeStore } from '@/store/useThemeStore';

// Atajo claro/oscuro para el encabezado de la agenda, con el mismo aspecto que
// la campana. Alterna sobre el tema ya aplicado (resolvedTheme), así que si la
// preferencia era "sistema" pasa a fijar el opuesto; volver a "sistema" se hace
// desde Configuración → Apariencia.
export function ThemeToggleButton() {
  const t = useTranslations('common.ThemeToggle');
  const resolved = useThemeStore(s => s.resolvedTheme);
  const aOscuro = resolved === 'light';
  const Icono = aOscuro ? Moon : Sun;

  return (
    <button
      onClick={() => setTheme(aOscuro ? 'dark' : 'light')}
      aria-label={t(aOscuro ? 'toDark' : 'toLight')}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: 38, height: 38, borderRadius: 19,
        border: `1px solid ${colors.border}`, backgroundColor: colors.surface, cursor: 'pointer',
      }}
    >
      <Icono size={18} color={colors.text} strokeWidth={1.8} />
    </button>
  );
}
