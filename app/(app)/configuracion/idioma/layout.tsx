'use client';

import { AgendaThemeScope } from '@/components/AgendaThemeScope';

export default function IdiomaLayout({ children }: { children: React.ReactNode }) {
  return <AgendaThemeScope>{children}</AgendaThemeScope>;
}
