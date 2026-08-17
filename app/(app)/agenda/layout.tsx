'use client';

import { useThemeStore } from '@/store/useThemeStore';

// Centraliza el className agenda-light/agenda-dark (app/globals.css) para
// toda la sección /agenda — antes cada page.tsx bajo esta carpeta calculaba
// resolvedTheme y armaba el className por su cuenta, 5 copias idénticas de
// la misma lógica (agenda, [id], nuevo, historia, recordatorios).
export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);
  return (
    <div className={resolvedTheme === 'dark' ? 'agenda-dark' : 'agenda-light'}>
      {children}
    </div>
  );
}
