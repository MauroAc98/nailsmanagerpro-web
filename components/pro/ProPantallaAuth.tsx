import type { ReactNode } from 'react';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { LogoPortal } from './LogoPortal';

interface Props {
  titulo: string;
  children: ReactNode;
}

// Marco común de las pantallas sin sesión completa (ingreso, cambio forzado de
// contraseña): marca, título y una columna angosta centrada.
export function ProPantallaAuth({ titulo, children }: Props) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        backgroundColor: agendaColors.bg,
      }}
    >
      <LogoPortal />
      <section style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong }}>{titulo}</h1>
        {children}
      </section>
    </main>
  );
}
