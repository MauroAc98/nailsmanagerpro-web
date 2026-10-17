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
import { agendaColors } from '@/theme/agendaColors';
import { FiltrosSheet } from './FiltrosSheet';
import { HojaTurnosPro } from './HojaTurnosPro';
import { CalendarioFechaSheet } from './CalendarioFechaSheet';
import { ListaTurnosDia } from './ListaTurnosDia';
import { ProHeader } from './ProHeader';
import { PRO_NAV_ALTURA, ProNav } from './ProNav';
import { ResultadosFiltros } from './ResultadosFiltros';
import { ResumenMesPro } from './ResumenMesPro';
import { ServicioFiltroSheet } from './ServicioFiltroSheet';

// Las hojas de fecha y de servicio que se abren desde Filtros van por encima de ella
// (hoja 60, fondo 59): son hermanas suyas, no hijas.
const CAPA_HOJA_DE_FILTROS = 62;

// La agenda de la titular no muestra un título de texto (va el logo): el h1 queda
// solo para lectores de pantalla y para recibir el foco al entrar.
const SOLO_LECTORES = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
  outline: 'none',
} as const;

// Agenda del portal: encabezado, resumen del mes, tira semanal y lista de turnos en una hoja. El
// calendario mensual vive en la hoja "Elegir fecha", que abre la tira o la hoja de
// filtros (la misma hoja, con otro destino para la fecha). Las hojas de fecha y de
// servicio de los filtros viven acá, no dentro de FiltrosSheet: el BottomSheet usa
// transform y atraparía su position: fixed. Los negocios bloqueados no se muestran
// acá: el guard redirige.
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
  // Quién abrió el calendario: la tira (elige el día que se ve) o los filtros (elige
  // la fecha del borrador).
  const [calendario, setCalendario] = useState<'tira' | 'filtros' | null>(null);
  const [servicioAbierto, setServicioAbierto] = useState(false);
  // Fecha y servicio del borrador de la hoja de filtros: parten de lo guardado cada
  // vez que se abre y solo se guardan con "Ver resultados".
  const [borrador, setBorrador] = useState({ fecha: filtros.desde, servicioId: filtros.servicioId });
  const abrirFiltros = () => {
    setBorrador({ fecha: filtros.desde, servicioId: filtros.servicioId });
    setFiltrosAbiertos(true);
  };
  // Al abrir, el calendario arranca en el mes de la fecha que muestra (puede haber
  // quedado en otro por una visita anterior que se cerró sin elegir).
  const abrirCalendario = (quien: 'tira' | 'filtros') => {
    const store = useProAgendaStore.getState();
    store.setMesVisto((quien === 'filtros' ? (borrador.fecha ?? store.fecha) : store.fecha).slice(0, 7));
    setCalendario(quien);
  };
  const elegirFecha = (f: string) => {
    if (calendario === 'filtros') setBorrador((b) => ({ ...b, fecha: f }));
    else useProAgendaStore.getState().setFecha(f);
    setCalendario(null);
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
  // las del mes de la tira, que suele ser el mismo). Con filtros activos la tira no
  // está: el calendario solo se abre desde la hoja de filtros.
  const calendarioVisible = calendario === 'filtros' || (calendario === 'tira' && !filtrando);
  const marcasCalendario = useProMarcasMes(calendarioVisible ? mesVisto : '');

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
          style={SOLO_LECTORES}
        >
          {t('titulo')}
        </h1>
        <FiltrosSheet
          abierto={filtrosAbiertos}
          onCerrar={cerrarFiltros}
          fecha={borrador.fecha}
          servicioId={borrador.servicioId}
          onBorrarFecha={() => setBorrador((b) => ({ ...b, fecha: null }))}
          onAbrirCalendario={() => abrirCalendario('filtros')}
          onAbrirServicios={() => setServicioAbierto(true)}
        />
        <CalendarioFechaSheet
          abierto={calendarioVisible}
          mes={mesVisto}
          fecha={calendario === 'filtros' ? (borrador.fecha ?? '') : fecha}
          zIndex={calendario === 'filtros' ? CAPA_HOJA_DE_FILTROS : undefined}
          marcas={marcasCalendario.data?.dias ?? null}
          error={marcasCalendario.error}
          onReintentar={marcasCalendario.reintentar}
          onElegir={elegirFecha}
          onCerrar={() => setCalendario(null)}
          onCambiarMes={(m) => useProAgendaStore.getState().setMesVisto(m)}
        />
        <ServicioFiltroSheet
          abierto={servicioAbierto}
          seleccionado={borrador.servicioId}
          onElegir={(servicioId) => {
            setBorrador((b) => ({ ...b, servicioId }));
            setServicioAbierto(false);
          }}
          onCerrar={() => setServicioAbierto(false)}
          zIndex={CAPA_HOJA_DE_FILTROS}
        />
        {filtrando && (
          <HojaTurnosPro
            fecha={fecha}
            filtrando
            cantidadActivos={cantidadActivos}
            botonFiltros={botonFiltros}
            onFiltrar={abrirFiltros}
          >
            <ResultadosFiltros onAbrir={abrirTurno} />
          </HojaTurnosPro>
        )}
        {!filtrando && (
          <>
            <ResumenMesPro mes={fecha.slice(0, 7)} />
            <WeekStrip
              dates={fechas}
              fechaSeleccionada={fecha}
              turnosMes={turnosMes}
              onDayClick={(f) => useProAgendaStore.getState().setFecha(f)}
              onAbrirCalendario={() => abrirCalendario('tira')}
              onSemanaAnterior={() => setAncla(sumarDias(ancla, -7))}
              onSemanaSiguiente={() => setAncla(sumarDias(ancla, 7))}
            />
            <HojaTurnosPro
              fecha={fecha}
              filtrando={false}
              cantidadActivos={0}
              botonFiltros={botonFiltros}
              onFiltrar={abrirFiltros}
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
