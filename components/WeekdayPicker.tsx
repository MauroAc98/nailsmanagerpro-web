'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  // Convención Carbon del backend: 0=domingo..6=sábado (ver
  // Profesional::atiendeEl / dias_atencion). El componente NO reordena
  // este array — solo controla qué valores contiene.
  value:    number[];
  onChange: (next: number[]) => void;
}

// Orden de aparición lunes-primero (UI) — distinto del orden de valores
// (0=domingo..6=sábado, ver arriba). Cada entrada es [valorBackend, claveDeMensaje].
const DIAS_LUNES_PRIMERO: Array<[number, string]> = [
  [1, 'mon'], [2, 'tue'], [3, 'wed'], [4, 'thu'], [5, 'fri'], [6, 'sat'], [0, 'sun'],
];

// ─────────────────────────────────────────────
// WeekdayPicker — 7 chips lunes→domingo para elegir en qué días de la
// semana atiende una profesional. Sin regla de mínimo seleccionado: vaciar
// todos los días es una selección válida a nivel de componente (la página
// que lo usa decide qué hacer con un array vacío vs. `null`, ver
// EditarProfesionalPage/NuevoProfesionalPage).
// ─────────────────────────────────────────────
export default function WeekdayPicker({ value, onChange }: Props) {
  const t = useTranslations('common.WeekdayPicker');

  const toggle = (dia: number) => {
    onChange(value.includes(dia) ? value.filter(d => d !== dia) : [...value, dia]);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {DIAS_LUNES_PRIMERO.map(([dia, clave]) => {
        const selected = value.includes(dia);
        return (
          <button
            key={dia}
            type="button"
            onClick={() => toggle(dia)}
            aria-pressed={selected}
            aria-label={t(`${clave}Full`)}
            style={{
              width: 36, height: 36, borderRadius: 18, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              backgroundColor: selected ? colors.primarySolid : colors.surfaceSubtle,
              color: selected ? '#fff' : colors.subtext,
              border: `1px solid ${selected ? colors.primarySolid : colors.border}`,
            }}
          >
            {t(clave)}
          </button>
        );
      })}
    </div>
  );
}
