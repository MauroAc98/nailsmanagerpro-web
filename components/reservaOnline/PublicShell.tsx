'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';
import { agendaColors } from '@/theme/agendaColors';

// Contenedor de las pantallas publicas de reserva. La clase `.reserva-publica`
// es el ancla del gate CSS de app/globals.css: sin ella `.app-shell` se oculta
// a >= 600px y la clienta que reserva desde una notebook veria el aviso
// "Turnetto es para celular". Columna centrada de 480px como maximo.
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <AgendaThemeScope>
      <div
        className="reserva-publica"
        style={{
          minHeight: '100dvh',
          background: agendaColors.bg,
          color: agendaColors.text,
        }}
      >
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>{children}</main>
      </div>
    </AgendaThemeScope>
  );
}
