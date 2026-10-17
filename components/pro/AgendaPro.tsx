'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { WeekStrip } from '@/components/agenda/WeekStrip';
import { useProMarcasMes } from '@/hooks/pro/useProMarcasMes';
import { useProTurnosDia } from '@/hooks/pro/useProTurnosDia';
import { useRutaPro } from '@/hooks/useRutaPro';
import { aDateLocal, diasDeSemana, sumarDias } from '@/lib/pro/semana';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { ListaTurnosDia } from './ListaTurnosDia';
import { ProHeader } from './ProHeader';
import { PRO_NAV_ALTURA_AGENDA, ProNav } from './ProNav';
import { VistaMes } from './VistaMes';

// Agenda del portal: vista de día (encabezado, tira semanal y lista de turnos) o
// vista mensual (VistaMes), según el store. Los negocios bloqueados no se muestran acá: el guard redirige.
export function AgendaPro() {
  const t = useTranslations('profesionales.Agenda');
  const ruta = useRutaPro();
  const router = useRouter();
  const fecha = useProAgendaStore((s) => s.fecha);
  const vista = useProAgendaStore((s) => s.vista);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Semana mostrada: sigue a la fecha elegida, y las flechas la mueven sin
  // cambiar esa fecha ni pedir turnos (ajuste de estado durante el render).
  const [ancla, setAncla] = useState(fecha);
  const [fechaVista, setFechaVista] = useState(fecha);
  const dias = diasDeSemana(ancla);
  if (fecha !== fechaVista) {
    setFechaVista(fecha);
    if (!dias.includes(fecha)) setAncla(fecha);
  }
  const fechas = dias.map(aDateLocal);

  const turnos = useProTurnosDia(fecha);
  // Una semana puede cruzar de mes: un pedido de marcas por mes (mes vacío = no pedir).
  const mesA = dias[0].slice(0, 7);
  const mesB = dias[6].slice(0, 7);
  const marcasA = useProMarcasMes(mesA);
  const marcasB = useProMarcasMes(mesB === mesA ? '' : mesB);
  const turnosMes = useMemo(
    () => [...(marcasA.data?.dias ?? []), ...(marcasB.data?.dias ?? [])],
    [marcasA.data, marcasB.data],
  );

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <>
      <main
        style={{
          boxSizing: 'border-box',
          minHeight: '100dvh',
          backgroundColor: agendaColors.bg,
          paddingBottom: `calc(${PRO_NAV_ALTURA_AGENDA}px + env(safe-area-inset-bottom))`,
        }}
      >
        <ProHeader />
        <h1
          ref={titulo}
          tabIndex={-1}
          style={{ margin: 0, padding: '0 20px 8px', fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong, outline: 'none' }}
        >
          {t('titulo')}
        </h1>
        {vista === 'dia' && (
          <>
            <WeekStrip
              dates={fechas}
              fechaSeleccionada={fecha}
              turnosMes={turnosMes}
              onDayClick={(f) => useProAgendaStore.getState().setFecha(f)}
              onAbrirCalendario={() => useProAgendaStore.getState().setVista('mes')}
              onSemanaAnterior={() => setAncla(sumarDias(ancla, -7))}
              onSemanaSiguiente={() => setAncla(sumarDias(ancla, 7))}
            />
            <div style={{ padding: '0 16px' }}>
              <ListaTurnosDia
                data={turnos.data}
                cargando={turnos.cargando}
                error={turnos.error}
                onReintentar={turnos.reintentar}
                onAbrir={(id) => router.push(ruta(`/turnos/${id}`))}
              />
            </div>
          </>
        )}
        {vista === 'mes' && <VistaMes />}
      </main>
      <ProNav />
    </>
  );
}
