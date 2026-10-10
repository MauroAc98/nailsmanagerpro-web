'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function UsoLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
