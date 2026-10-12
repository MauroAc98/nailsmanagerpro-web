'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Profesional } from '@/services/profesionalService';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { FilaQueMostrar } from '@/components/filtros/FilaQueMostrar';
import { TarjetaQueMostrar } from '@/components/filtros/TarjetaQueMostrar';
import { NegocioIcono, ProfesionalSheet } from '@/components/filtros/ProfesionalSheet';

interface Props {
  profesionales: Profesional[];
  /** id de la profesional elegida, o null = "Del negocio". */
  value: number | null;
  onChange: (id: number | null) => void;
  labelNegocio: string;
}

const NEGOCIO = 'negocio';

// Siempre hay exactamente una opción elegida: volver a elegir la ya elegida no
// avisa nada. Fila + hoja compartidas; "Del negocio" es un extra de la hoja.
export default function SelectorProfesionalONegocio({ profesionales, value, onChange, labelNegocio }: Props) {
  const t = useTranslations('common.SelectorProfesionalONegocio');
  const [abierta, setAbierta] = useState(false);
  const elegida = value === null ? undefined : profesionales.find(p => p.id === value);

  return (
    <>
      <TarjetaQueMostrar>
        <FilaQueMostrar
          leading={elegida ? (
            <AvatarProfesional
              nombre={elegida.nombre}
              apellido={elegida.apellido}
              color={elegida.color}
              avatarUrl={elegida.avatar_url}
            />
          ) : <NegocioIcono />}
          titulo={t('title')}
          valor={elegida ? elegida.nombre : labelNegocio}
          activo
          onClick={() => setAbierta(true)}
        />
      </TarjetaQueMostrar>

      <ProfesionalSheet
        open={abierta}
        onClose={() => setAbierta(false)}
        onSelect={sel => {
          const nuevo = sel === NEGOCIO ? null : (sel as number);
          if (nuevo !== value) onChange(nuevo);
        }}
        title={t('title')}
        cerrarLabel={t('close')}
        extras={[{ id: NEGOCIO, label: labelNegocio, icono: <NegocioIcono /> }]}
        profesionales={profesionales.map(p => ({
          id: p.id, nombre: p.nombre, apellido: p.apellido, color: p.color, avatarUrl: p.avatar_url,
        }))}
        selectedId={value ?? NEGOCIO}
      />
    </>
  );
}
