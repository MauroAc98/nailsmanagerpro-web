'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function CobrosLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
