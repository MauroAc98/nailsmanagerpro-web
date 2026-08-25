'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function AparienciaLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
