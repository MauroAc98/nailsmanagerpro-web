'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function GastosLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
