'use client';

import { useThemeStore } from '@/store/useThemeStore';

// Aplica agenda-light/agenda-dark (app/globals.css, vars --ag-* scoped) a
// cualquier subárbol que use la paleta del rediseño — no hace falta estar
// físicamente bajo /agenda. Extraído de app/(app)/agenda/layout.tsx (el
// caso original) para reusarlo en app/(app)/configuracion/estadisticas/layout.tsx,
// la primera pantalla rediseñada fuera de esa carpeta.
export function AgendaThemeScope({ children }: { children: React.ReactNode }) {
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);
  return (
    <div className={resolvedTheme === 'dark' ? 'agenda-dark' : 'agenda-light'}>
      {children}
    </div>
  );
}
