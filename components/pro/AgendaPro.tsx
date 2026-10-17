'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { WeekStrip } from '@/components/agenda/WeekStrip';
import { useProMarcasMes } from '@/hooks/pro/useProMarcasMes';
import { useProTurnosDia } from '@/hooks/pro/useProTurnosDia';
import { useRutaPro } from '@/hooks/useRutaPro';
import { hayFiltrosActivos, normalizarBuscar } from '@/lib/pro/filtros';
import { aDateLocal, diasDeSemana, sumarDias } from '@/lib/pro/semana';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { FiltrosSheet } from './FiltrosSheet';
import { ListaTurnosDia } from './ListaTurnosDia';
import { ProHeader } from './ProHeader';
import { PRO_NAV_ALTURA_AGENDA, ProNav } from './ProNav';
import { ResultadosFiltros } from './ResultadosFiltros';
import { VistaMes } from './VistaMes';

// Agenda del portal: vista de día (encabezado, tira semanal y lista de turnos) o
// vista mensual (VistaMes), según el store. Los negocios bloqueados no se muestran acá: el guard redirige.
export function AgendaPro() {
  const t = useTranslations('profesionales.Agenda');
  const ruta = useRutaPro();
  const router = useRouter();
  const fecha = useProAgendaStore((s) => s.fecha);
  const vista = useProAgendaStore((s) => s.vista);
  const filtros = useProAgendaStore((s) => s.filtros);
  const tFiltros = useTranslations('profesionales.Filtros');
  const titulo = useRef<HTMLHeadingElement>(null);
  const botonFiltros = useRef<HTMLButtonElement>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const abrirTurno = (id: number) => router.push(ruta(`/turnos/${id}`));
  // Quien abrió la hoja recupera el foco al cerrarla.
  const cerrarFiltros = () => {
    setFiltrosAbiertos(false);
    botonFiltros.current?.focus();
  };

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

  // Con filtros activos la pantalla muestra solo sus resultados: no se piden ni
  // el día ni las marcas (fecha o mes vacío = no pedir).
  const filtrando = hayFiltrosActivos(filtros);
  const cantidadActivos =
    Number(normalizarBuscar(filtros.buscar) !== '') + Number(filtros.servicioId !== null) + Number(filtros.desde !== null);
  const turnos = useProTurnosDia(filtrando ? '' : fecha);
  // Una semana puede cruzar de mes: un pedido de marcas por mes.
  const mesA = dias[0].slice(0, 7);
  const mesB = dias[6].slice(0, 7);
  const marcasA = useProMarcasMes(filtrando ? '' : mesA);
  const marcasB = useProMarcasMes(filtrando || mesB === mesA ? '' : mesB);
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
        <div style={{ padding: '0 16px 8px' }}>
          <button
            ref={botonFiltros}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setFiltrosAbiertos(true)}
            style={{
              minHeight: 44,
              padding: '0 16px',
              border: `1px solid ${filtrando ? agendaColors.primarySolid : agendaColors.fieldBorder}`,
              borderRadius: 12,
              fontSize: 15,
              fontWeight: filtrando ? 700 : 600,
              cursor: 'pointer',
              backgroundColor: agendaColors.surface,
              color: agendaColors.strong,
            }}
          >
            {filtrando ? tFiltros('botonActivos', { cantidad: cantidadActivos }) : tFiltros('boton')}
          </button>
        </div>
        <FiltrosSheet abierto={filtrosAbiertos} onCerrar={cerrarFiltros} />
        {filtrando && (
          <div style={{ padding: '0 16px' }}>
            <ResultadosFiltros onAbrir={abrirTurno} />
          </div>
        )}
        {!filtrando && vista === 'dia' && (
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
                onAbrir={abrirTurno}
              />
            </div>
          </>
        )}
        {!filtrando && vista === 'mes' && <VistaMes />}
      </main>
      <ProNav />
    </>
  );
}
