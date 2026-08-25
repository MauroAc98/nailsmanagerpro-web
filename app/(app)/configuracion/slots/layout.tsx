'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function SlotsLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
