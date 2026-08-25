'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function ServiciosLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
