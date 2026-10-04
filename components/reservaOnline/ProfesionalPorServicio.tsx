'use client';

import { useTranslations } from 'next-intl';
import SelectorProfesional from '@/components/SelectorProfesional';
import type { Asignacion, BookableService, ProfesionalPublico } from '@/lib/reservaOnline/types';
import { agendaColors as colors } from '@/theme/agendaColors';

// Una profesional EXPLICITA por servicio (sin "Cualquiera"): el cliente que
// reparte sus servicios entre profesionales elige quien hace cada uno. El
// orden de los servicios es el orden en que los eligio. Volver a "una sola
// persona" lo resuelve el control de QuienTeAtiende.
export function ProfesionalPorServicio({
  servicios,
  grupos,
  opciones,
  onElegir,
}: {
  servicios: BookableService[];
  grupos: Asignacion[];
  // Profesionales que hacen cada servicio, por id de servicio.
  opciones: Record<number, ProfesionalPublico[]>;
  onElegir: (servicioId: number, profesionalId: number) => void;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <div>
      {grupos.map((g) => {
        const servicio = servicios.find((s) => s.id === g.servicioIds[0]);
        const quienes = opciones[g.servicioIds[0]] ?? [];
        return (
          <div key={g.servicioIds[0]}>
            <SelectorProfesional
              label={servicio?.nombre ?? ''}
              labelStyle={{
                margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: colors.strong, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              profesionales={quienes}
              selectedId={g.profesionalId ?? null}
              toggleable={false}
              onSelect={(id) => id !== null && onElegir(g.servicioIds[0], id)}
              selectedFg={colors.primaryFg}
              unselectedBorderColor={colors.border}
              pillFontWeight={600}
            />
            {/* Una sola opcion: no hay nada que elegir; se dice por que (no es un boton roto). */}
            {quienes.length === 1 && (
              <p style={{ margin: '-4px 0 12px', fontSize: 12.5, color: colors.sub }}>
                {t('horario.soloHace', { nombre: quienes[0].nombre })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
