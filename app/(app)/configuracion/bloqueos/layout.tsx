'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function BloqueosLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
