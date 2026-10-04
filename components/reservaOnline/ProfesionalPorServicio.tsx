'use client';

import { useTranslations } from 'next-intl';
import SelectorProfesional from '@/components/SelectorProfesional';
import type { Asignacion, BookableService, ProfesionalPublico } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';
import { IcoPersonas } from './iconos';
import { BotonSecundario } from './ui';

// Una profesional EXPLICITA por servicio (sin "Cualquiera"): el cliente que
// reparte sus servicios entre profesionales elige quien hace cada uno. El
// orden de los servicios es el orden en que los eligio.
export function ProfesionalPorServicio({
  servicios,
  grupos,
  opciones,
  onElegir,
  onVolver,
}: {
  servicios: BookableService[];
  grupos: Asignacion[];
  // Profesionales que hacen cada servicio, por id de servicio.
  opciones: Record<number, ProfesionalPublico[]>;
  onElegir: (servicioId: number, profesionalId: number) => void;
  onVolver: () => void;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <div>
      {grupos.map((g) => {
        const servicio = servicios.find((s) => s.id === g.servicioIds[0]);
        return (
          <SelectorProfesional
            key={g.servicioIds[0]}
            label={servicio?.nombre ?? ''}
            labelStyle={{
              margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: colors.strong, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            profesionales={opciones[g.servicioIds[0]] ?? []}
            selectedId={g.profesionalId ?? null}
            toggleable={false}
            onSelect={(id) => id !== null && onElegir(g.servicioIds[0], id)}
            selectedFg={colors.primaryFg}
            unselectedBorderColor={colors.border}
            pillFontWeight={600}
          />
        );
      })}
      <BotonSecundario onClick={onVolver} icono={<IcoPersonas color={colors.primaryDeep} size={18} />}>
        {t('horario.unaSola')}
      </BotonSecundario>
    </div>
  );
}
