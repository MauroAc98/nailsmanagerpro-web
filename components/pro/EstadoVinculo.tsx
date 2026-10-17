'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { bloqueoEfectivo } from '@/lib/pro/acceso';
import { MOTIVOS_VINCULO } from '@/lib/pro/errores';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors } from '@/theme/agendaColors';
import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';
import { ProPantallaAuth } from './ProPantallaAuth';

interface Props {
  variante: 'deshabilitado' | 'sinServicio';
}

const botonBase = {
  minHeight: 44,
  padding: '0 24px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

// Pantalla de estado de un negocio bloqueado (SE-11): acceso quitado por la
// persona titular o negocio sin servicio. NO pide datos: solo lee el store, y
// muestra únicamente el nombre del negocio. Cambiar de negocio abre el sheet de
// la propia pantalla; al elegir uno usable el guard saca de acá.
export function EstadoVinculo({ variante }: Props) {
  const t = useTranslations('profesionales.EstadoVinculo');
  const tMotivo = useTranslations('profesionales.Motivo');
  const vinculos = useProAuthStore((s) => s.vinculos);
  const bloqueos = useProAuthStore((s) => s.bloqueos);
  const activoId = useProAuthStore((s) => s.vinculoActivoId);
  const [abierto, setAbierto] = useState(false);

  const referencia = vinculos.find((v) => v.id === activoId) ?? vinculos[0] ?? null;
  const bloqueo = referencia ? bloqueoEfectivo(referencia, bloqueos) : null;
  const motivo = bloqueo?.motivo != null && MOTIVOS_VINCULO.includes(bloqueo.motivo) ? bloqueo.motivo : 'generico';
  // Hay adónde ir si existe algún negocio usable distinto del actual.
  const puedeCambiar = vinculos.some((v) => v.id !== referencia?.id && bloqueoEfectivo(v, bloqueos) === null);

  const descripcion = variante === 'deshabilitado' ? t('deshabilitado.descripcion') : tMotivo(motivo);

  return (
    <ProPantallaAuth titulo={t(`${variante}.titulo`)}>
      {referencia && (
        <p
          style={{
            margin: 0,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 16,
            fontWeight: 600,
            color: agendaColors.strong,
          }}
        >
          {referencia.negocioNombre}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 15, color: agendaColors.sub }}>{descripcion}</p>
      {variante === 'sinServicio' && puedeCambiar && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAbierto(true)}
          style={{ ...botonBase, border: 'none', backgroundColor: agendaColors.primarySolid, color: agendaColors.primaryFg }}
        >
          {t('cambiarNegocio')}
        </button>
      )}
      <button
        type="button"
        onClick={() => void useProAuthStore.getState().logout()}
        style={{ ...botonBase, border: `1px solid ${agendaColors.border}`, backgroundColor: 'transparent', color: agendaColors.sub }}
      >
        {t('cerrarSesion')}
      </button>
      {puedeCambiar && <NegocioSwitcherSheet abierto={abierto} onCerrar={() => setAbierto(false)} />}
    </ProPantallaAuth>
  );
}
