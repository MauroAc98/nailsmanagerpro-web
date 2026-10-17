import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';

// Marca del portal: texto simple provisorio. El logo definitivo se incorpora
// más adelante (P13) sin cambiar quién lo usa.
export function LogoPortal() {
  return (
    <div
      aria-hidden="true"
      style={{ fontFamily: agendaFontSerif, fontSize: 28, fontWeight: 600, color: agendaColors.primaryDeep }}
    >
      Turnetto
    </div>
  );
}
