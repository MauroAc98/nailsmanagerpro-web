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
import { HojaTurnosPro } from './HojaTurnosPro';
import { CalendarioFechaSheet } from './CalendarioFechaSheet';
import { ListaTurnosDia } from './ListaTurnosDia';
import { ProHeader } from './ProHeader';
import { PRO_NAV_ALTURA, ProNav } from './ProNav';
import { ResultadosFiltros } from './ResultadosFiltros';

// Agenda del portal: encabezado, tira semanal y lista de turnos en una hoja. El
// calendario mensual vive en la hoja "Elegir fecha", que abre la tira. Los negocios
// bloqueados no se muestran acá: el guard redirige.
export function AgendaPro() {
  const t = useTranslations('profesionales.Agenda');
  const ruta = useRutaPro();
  const router = useRouter();
  const fecha = useProAgendaStore((s) => s.fecha);
  const mesVisto = useProAgendaStore((s) => s.mesVisto);
  const filtros = useProAgendaStore((s) => s.filtros);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botonFiltros = useRef<HTMLButtonElement>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  // Al abrir, el calendario arranca en el mes de la fecha elegida (puede haber
  // quedado en otro por una visita anterior que se cerró sin elegir).
  const abrirCalendario = () => {
    const store = useProAgendaStore.getState();
    store.setMesVisto(store.fecha.slice(0, 7));
    setCalendarioAbierto(true);
  };
  const elegirFecha = (f: string) => {
    useProAgendaStore.getState().setFecha(f);
    setCalendarioAbierto(false);
  };
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

  // Las marcas del calendario se piden solo con la hoja abierta (la caché sirve
  // las del mes de la tira, que suele ser el mismo).
  const marcasCalendario = useProMarcasMes(calendarioAbierto && !filtrando ? mesVisto : '');

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
          paddingBottom: `calc(${PRO_NAV_ALTURA}px + env(safe-area-inset-bottom))`,
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
        <FiltrosSheet abierto={filtrosAbiertos} onCerrar={cerrarFiltros} />
        <CalendarioFechaSheet
          abierto={calendarioAbierto && !filtrando}
          mes={mesVisto}
          fecha={fecha}
          marcas={marcasCalendario.data?.dias ?? null}
          error={marcasCalendario.error}
          onReintentar={marcasCalendario.reintentar}
          onElegir={elegirFecha}
          onCerrar={() => setCalendarioAbierto(false)}
          onCambiarMes={(m) => useProAgendaStore.getState().setMesVisto(m)}
        />
        {filtrando && (
          <HojaTurnosPro
            fecha={fecha}
            filtrando
            cantidadActivos={cantidadActivos}
            botonFiltros={botonFiltros}
            onFiltrar={() => setFiltrosAbiertos(true)}
          >
            <ResultadosFiltros onAbrir={abrirTurno} />
          </HojaTurnosPro>
        )}
        {!filtrando && (
          <>
            <WeekStrip
              dates={fechas}
              fechaSeleccionada={fecha}
              turnosMes={turnosMes}
              onDayClick={(f) => useProAgendaStore.getState().setFecha(f)}
              onAbrirCalendario={abrirCalendario}
              onSemanaAnterior={() => setAncla(sumarDias(ancla, -7))}
              onSemanaSiguiente={() => setAncla(sumarDias(ancla, 7))}
            />
            <HojaTurnosPro
              fecha={fecha}
              filtrando={false}
              cantidadActivos={0}
              botonFiltros={botonFiltros}
              onFiltrar={() => setFiltrosAbiertos(true)}
            >
              <ListaTurnosDia
                data={turnos.data}
                cargando={turnos.cargando}
                error={turnos.error}
                onReintentar={turnos.reintentar}
                onAbrir={abrirTurno}
              />
            </HojaTurnosPro>
          </>
        )}
      </main>
      <ProNav />
    </>
  );
}
