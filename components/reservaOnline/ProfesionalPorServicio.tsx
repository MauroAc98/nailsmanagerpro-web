'use client';

import { useTranslations } from 'next-intl';
import type { Asignacion, BookableService, ProfesionalPublico } from '@/lib/reservaOnline/types';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import { agendaColors as colors } from '@/theme/agendaColors';
import { AvatarProfesional } from './AvatarProfesional';

const chip = (activo: boolean) =>
  ({
    display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, minWidth: 0,
    padding: '4px 14px 4px 4px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    border: `1.5px solid ${activo ? colors.primarySolid : colors.border}`,
    background: activo ? colors.primarySolid : colors.surface,
    color: activo ? colors.primaryFg : colors.text,
  }) as const;

// Una profesional EXPLICITA por servicio (sin "Cualquiera"): el cliente que
// reparte sus servicios elige quien hace cada uno. Cada servicio es una fila con
// su duracion y sus opciones al lado. El orden de los servicios es el orden en
// que los eligio. Volver a "una sola persona" lo resuelve el control de
// QuienTeAtiende.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {grupos.map((g) => {
        const sid = g.servicioIds[0];
        const servicio = servicios.find((s) => s.id === sid);
        const quienes = opciones[sid] ?? [];
        const duracion = servicio ? formatearDuracion(servicio.duracionMinutos) : '';
        return (
          <div
            key={sid}
            style={{
              display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 16,
              background: colors.surface2, border: `1px solid ${colors.hairline}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  minWidth: 0, fontSize: 14, fontWeight: 700, color: colors.strong,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {servicio?.nombre ?? ''}
              </span>
              {duracion && <span style={{ flexShrink: 0, fontSize: 12, color: colors.sub }}>{duracion}</span>}
            </div>
            {quienes.length === 1 ? (
              // Una sola opcion: no hay nada que elegir; se dice por que (no es un boton roto).
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.sub }}>
                <AvatarProfesional nombre={quienes[0].nombre} avatarUrl={quienes[0].avatarUrl} size={30} />
                {t('horario.soloHace', { nombre: quienes[0].nombre })}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {quienes.map((p) => {
                  const activa = g.profesionalId === p.id;
                  return (
                    <button key={p.id} type="button" aria-pressed={activa} onClick={() => onElegir(sid, p.id)} style={chip(activa)}>
                      <AvatarProfesional
                        nombre={p.nombre}
                        avatarUrl={p.avatarUrl}
                        size={30}
                        fg={activa ? colors.primaryFg : undefined}
                        bg={activa ? 'rgba(255,255,255,0.25)' : undefined}
                      />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
