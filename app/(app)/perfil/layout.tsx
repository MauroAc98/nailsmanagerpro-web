'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
