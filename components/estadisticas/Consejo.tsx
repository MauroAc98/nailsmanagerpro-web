import { Lightbulb } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';

export function Consejo({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
      backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: '10px 12px',
      fontSize: 12, lineHeight: 1.45, color: colors.text,
    }}>
      <Lightbulb size={15} color={colors.amber} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}
