'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import BackButton from '@/components/BackButton';
import OpcionesSheet from '@/components/cobros/OpcionesSheet';
import { Spinner } from '@/components/Spinner';
import { MontoFit } from '@/components/estadisticas/MontoFit';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { NAV_CLEARANCE } from '@/constants/layout';
import { formatMonto } from '@/lib/money';
import {
  parsePagoFiltro,
  type EstadoPago,
  type PagoFiltro,
  type PeriodoFiltro,
  type TurnoFiltro,
} from '@/lib/cobros';
import type { TurnoConCobro } from '@/services/cobrosService';
import { useCobrosStore } from '@/store/useCobrosStore';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';

const monto = (n: number) => `$${formatMonto(n)}`;

// Espera tras dejar de tipear antes de buscar en el servidor (igual que Clientes).
const ESPERA_BUSQUEDA_MS = 500;
// Alto estimado de una tarjeta hasta que la lista la mide.
const ALTO_ESTIMADO = 110;

function formatFechaHora(fechaHora: string): string {
  const d = new Date(fechaHora.replace(' ', 'T'));
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

const nombreCliente = (turno: TurnoConCobro) => `${turno.cliente.nombre} ${turno.cliente.apellido}`.trim();

type TurnoKey = 'turnoTodos' | 'turnoConfirmados' | 'turnoFinalizados';
type PagoKey = 'pagoTodos' | 'pagoSena' | 'pagoTodo' | 'pagoNada' | 'pagoSinPrecio';
type PeriodoKey = 'periodoTodo' | 'periodoHoy' | 'periodo7dias' | 'periodoMes' | 'periodoProximos';

const TURNO_OPCIONES: { valor: TurnoFiltro; key: TurnoKey }[] = [
  { valor: 'todos', key: 'turnoTodos' },
  { valor: 'confirmado', key: 'turnoConfirmados' },
  { valor: 'finalizado', key: 'turnoFinalizados' },
];
const PAGO_OPCIONES: { valor: PagoFiltro; key: PagoKey }[] = [
  { valor: 'todos', key: 'pagoTodos' },
  { valor: 'sinprecio', key: 'pagoSinPrecio' },
  { valor: 'sena', key: 'pagoSena' },
  { valor: 'nada', key: 'pagoNada' },
  { valor: 'todo', key: 'pagoTodo' },
];
const PERIODO_OPCIONES: { valor: PeriodoFiltro; key: PeriodoKey }[] = [
  { valor: 'todo', key: 'periodoTodo' },
  { valor: 'hoy', key: 'periodoHoy' },
  { valor: '7dias', key: 'periodo7dias' },
  { valor: 'mes', key: 'periodoMes' },
  { valor: 'proximos', key: 'periodoProximos' },
];
const PILL_PAGO_KEY: Record<EstadoPago, 'pillSena' | 'pillTodo' | 'pillNada' | 'pillSinPrecio'> = {
  sena: 'pillSena',
  todo: 'pillTodo',
  nada: 'pillNada',
  sinprecio: 'pillSinPrecio',
};
const TONO_PAGO: Record<EstadoPago, 'ok' | 'warn' | 'none'> = { sena: 'warn', todo: 'ok', nada: 'none', sinprecio: 'warn' };

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.card,
  borderRadius: 14,
};

function Pill({ tono, children }: { tono: 'ok' | 'warn' | 'none'; children: React.ReactNode }) {
  const paleta = {
    ok: { bg: colors.successBg, fg: colors.success },
    warn: { bg: colors.amberBg, fg: colors.amberFg },
    none: { bg: colors.surfaceSubtle, fg: colors.subtext },
  }[tono];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 99, padding: '2px 9px', backgroundColor: paleta.bg, color: paleta.fg }}>
      {children}
    </span>
  );
}

// Celda de la barra de estados: el número arriba y la etiqueta abajo. Las cinco
// miden lo mismo, así que entran en una sola fila sin scroll.
function celdaStyle(activo: boolean): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 56, minWidth: 0, padding: '6px 2px', border: 'none', borderRadius: 10, cursor: 'pointer',
    backgroundColor: activo ? colors.primarySolid : 'transparent',
    color: activo ? colors.primaryFg : colors.textStrong,
  };
}

function botonFiltroStyle(activo: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.surface, border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
    boxShadow: shadows.card, borderRadius: 12, padding: '10px 14px',
    fontSize: 14, fontWeight: 600, color: colors.text, cursor: 'pointer',
  };
}

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

interface FilaProps {
  turno: TurnoConCobro;
  profesional: string | null;
  onUsarLista: () => void;
  onCargar: () => void;
}

function FilaCobro({ turno, profesional, onUsarLista, onCargar }: FilaProps) {
  const t = useTranslations('agenda.CobrosPage');
  const { cobro } = turno;
  const servicios = turno.servicios.map(s => s.nombre).join(', ');

  // Tres filas, dos columnas: lo que se lee a la izquierda (cliente, servicio,
  // fecha y estado del turno) y lo que se lee a la derecha (monto, aclaración
  // y estado del pago) quedan alineados fila contra fila.
  const meta = [
    formatFechaHora(turno.fecha_hora),
    profesional ? t('conProfesional', { nombre: profesional }) : null,
    cobro.finalizado ? t('pillFinalizado') : t('pillConfirmado'),
  ]
    .filter(Boolean)
    .join(' · ');

  let principal: string;
  let secundario = '';
  let falta = false;
  if (cobro.pago === 'sinprecio') {
    principal = cobro.lista_completa ? t('listaMonto', { monto: monto(cobro.precio_lista) }) : t('sinPrecioLista');
    if (cobro.sena > 0) secundario = t('senaMonto', { monto: monto(cobro.sena) });
  } else if (cobro.finalizado) {
    principal = monto(cobro.cobrado ?? 0);
    if (cobro.sena > 0) secundario = t('incluyeSena', { monto: monto(cobro.sena) });
  } else if (cobro.sena_compartida) {
    principal = monto(cobro.sena);
    secundario = t('senaDelGrupo');
  } else {
    principal = monto(cobro.sena);
    if (cobro.falta_fila != null) {
      secundario = t('faltaMonto', { monto: monto(cobro.falta_fila) });
      falta = cobro.falta_fila > 0;
    }
  }

  return (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 12, rowGap: 3, alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: colors.textStrong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nombreCliente(turno)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {principal}
        </div>
        <div style={{ fontSize: 13, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{servicios}</div>
        <div style={{ fontSize: 12, color: falta ? colors.amberFg : colors.subtext, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {secundario}
        </div>
        <div style={{ fontSize: 12, color: colors.subtext, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <Pill tono={TONO_PAGO[cobro.pago]}>{t(PILL_PAGO_KEY[cobro.pago])}</Pill>
        </div>
      </div>
      {cobro.pago === 'sinprecio' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {cobro.lista_completa && (
            <button
              onClick={onUsarLista}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface, color: colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('useListPrice')}
            </button>
          )}
          <button
            onClick={onCargar}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10, border: 'none',
              backgroundColor: colors.primarySolid, color: colors.primaryFg, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('loadPrice')}
          </button>
        </div>
      )}
    </div>
  );
}

// Lo que dibuja la lista: la cabecera (título, resumen, filtros) es la fila 0,
// así toda la pantalla scrollea junta y las alturas se miden solas.
type Item =
  | { tipo: 'encabezado' }
  | { tipo: 'cargando' }
  | { tipo: 'vacio' }
  | { tipo: 'turno'; turno: TurnoConCobro }
  | { tipo: 'mas' };

interface FilaListaProps {
  items: Item[];
  encabezado: ReactNode;
  atenuado: boolean;
  textoCargando: string;
  textoVacio: string;
  textoMas: string;
  profesionalDe: (id?: number | null) => string | null;
  onUsarLista: (turno: TurnoConCobro) => void;
  onCargar: (turno: TurnoConCobro) => void;
}

function FilaLista({
  index, style, items, encabezado, atenuado, textoCargando, textoVacio, textoMas, profesionalDe, onUsarLista, onCargar,
}: RowComponentProps<FilaListaProps>) {
  const item = items[index];
  if (!item) return null;
  let contenido: ReactNode;
  switch (item.tipo) {
    case 'encabezado':
      contenido = encabezado;
      break;
    case 'cargando':
      contenido = (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner label={textoCargando} />
        </div>
      );
      break;
    case 'vacio':
      contenido = <p style={{ textAlign: 'center', color: colors.subtext, margin: 0, fontSize: 14, padding: '22px 0' }}>{textoVacio}</p>;
      break;
    case 'mas':
      contenido = (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <Spinner label={textoMas} size={24} />
        </div>
      );
      break;
    case 'turno':
      contenido = (
        <div style={{ opacity: atenuado ? 0.55 : 1, transition: 'opacity 0.15s' }}>
          <FilaCobro
            turno={item.turno}
            profesional={profesionalDe(item.turno.profesional_id)}
            onUsarLista={() => onUsarLista(item.turno)}
            onCargar={() => onCargar(item.turno)}
          />
        </div>
      );
      break;
  }

  // Un solo elemento raíz: la lista lo mide (con el padding incluido).
  return (
    <div style={{ ...style, padding: item.tipo === 'encabezado' ? 0 : '0 20px 10px', boxSizing: 'border-box' }}>
      {contenido}
    </div>
  );
}

function CobrosContenido() {
  const t = useTranslations('agenda.CobrosPage');
  const searchParams = useSearchParams();
  const {
    turnos, counts, resumen, listaBulk, cargando, cargandoMas, error,
    cargarPrimeraPagina, cargarSiguientePagina, recargar,
  } = useCobrosStore();
  const { actualizarPrecios } = usePendientesDeCobroStore();
  const { servicios, fetchServicios } = useServiciosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const [turnoFiltro, setTurnoFiltro] = useState<TurnoFiltro>('todos');
  const [pagoFiltro, setPagoFiltro] = useState<PagoFiltro>(() => parsePagoFiltro(searchParams.get('pago')));
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>('todo');
  const [q, setQ] = useState('');
  const [buscarAplicado, setBuscarAplicado] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [hoja, setHoja] = useState<'periodo' | 'turno'>('periodo');
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const abrirHoja = (cual: 'periodo' | 'turno') => {
    setHoja(cual);
    setHojaAbierta(true);
  };

  useEffect(() => {
    fetchServicios();
    if (profesionales.length === 0) fetchProfesionales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda server-side con debounce: cada tipeo reinicia el timer, así no se
  // dispara un pedido por tecla.
  useEffect(() => {
    const timer = setTimeout(() => setBuscarAplicado(q.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // Cualquier cambio de filtro vuelve a pedir la primera página: los filtros,
  // los conteos y los totales los calcula el backend sobre TODO el conjunto.
  useEffect(() => {
    cargarPrimeraPagina({ turno: turnoFiltro, pago: pagoFiltro, periodo: periodoFiltro, buscar: buscarAplicado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoFiltro, pagoFiltro, periodoFiltro, buscarAplicado]);

  const referencias = useMemo(() => new Map(servicios.map(s => [s.id, s.precio])), [servicios]);
  const nombreProfesional = (id?: number | null) => {
    const p = id != null ? profesionales.find(x => x.id === id) : undefined;
    return p ? p.nombre : null;
  };

  const guardar = async (turno: TurnoConCobro, precios: { servicio_id: number; precio: number }[]) => {
    const result = await actualizarPrecios(turno.id, precios);
    if (result.success) {
      showToast(t('saved'));
      await recargar();
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
    return result.success;
  };

  const cargarConSheet = async (turno: TurnoConCobro): Promise<boolean> => {
    const aPrecificar = turno.servicios.map(s => {
      const ref = referencias.get(s.id);
      return { servicio_id: s.id, nombre: s.nombre, precioReferencia: ref != null && ref !== '' ? Number(ref) : null };
    });
    const precios = await pedirPreciosServicios(aPrecificar, {
      cliente: nombreCliente(turno),
      fechaHora: turno.fecha_hora,
      modo: 'cargar',
    });
    if (!precios) return false;
    return guardar(turno, precios);
  };

  const handleUsarLista = async (turno: TurnoConCobro) => {
    // Es dato de plata y no hay "deshacer" desde acá: confirmación breve.
    const ok = await confirmDialog(
      t('confirmUseListPrice', { cliente: nombreCliente(turno), monto: monto(turno.cobro.precio_lista) }),
      { confirmText: t('confirmUseListPriceButton') },
    );
    if (!ok) return;
    await guardar(turno, turno.servicios.map(s => ({ servicio_id: s.id, precio: Number(referencias.get(s.id)) })));
  };

  // Registro en bloque a precio de lista: el backend arma la lista sobre TODOS
  // los "falta cargar el precio" del filtro actual (no solo los ya cargados en
  // pantalla) cuyos servicios tienen todos precio de lista.
  const handleUsarListaEnTodos = async () => {
    const lote = listaBulk.items; // snapshot
    const ok = await confirmDialog(
      t('confirmUseListPriceAll', { count: listaBulk.count, monto: monto(listaBulk.total) }),
      { confirmText: t('confirmUseListPriceButton') },
    );
    if (!ok) return;

    let hechos = 0;
    for (const item of lote) {
      const result = await actualizarPrecios(item.turno_id, item.precios);
      if (!result.success) {
        await recargar();
        await alertDialog(t('bulkPartialError', { done: hechos, total: lote.length, error: result.message ?? t('saveError') }));
        return;
      }
      hechos += 1;
    }
    showToast(t('bulkSaved', { count: hechos }));
    await recargar();
  };

  const alternarBusqueda = () => {
    if (buscando) setQ('');
    setBuscando(v => !v);
  };

  const textoPeriodo = t(PERIODO_OPCIONES.find(o => o.valor === periodoFiltro)!.key);
  const textoTurno = t(TURNO_OPCIONES.find(o => o.valor === turnoFiltro)!.key);

  const encabezado = (
    <div>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        <p style={{ fontSize: 14, color: colors.subtext, margin: '4px 0 0' }}>{t('subtitle')}</p>
      </div>

      <div style={{ padding: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
          <div
            data-testid="resumen-falta"
            style={{ ...cardStyle, backgroundColor: colors.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.amberFg, flexShrink: 0 }}>{t('summaryFalta')}</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontWeight: 700, color: colors.textStrong, fontVariantNumeric: 'tabular-nums' }}>
              <MontoFit maxFontSize={18} minFontSize={11}>{monto(resumen.falta_cobrar)}</MontoFit>
            </div>
          </div>
          <div
            data-testid="resumen-cobrado"
            style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px' }}
          >
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.subtext }}>{t('summaryCobrado')}</div>
              {resumen.sena_en_pendientes > 0 && (
                <div style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
                  {t('summaryIncluyeSena', { monto: monto(resumen.sena_en_pendientes) })}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontWeight: 700, color: colors.textStrong, fontVariantNumeric: 'tabular-nums' }}>
              <MontoFit maxFontSize={18} minFontSize={11}>{monto(resumen.cobrado_total)}</MontoFit>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={t('filterPago')}
          style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4, padding: 4 }}
        >
          {PAGO_OPCIONES.map(o => {
            const activo = o.valor === pagoFiltro;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={activo}
                aria-label={`${t(o.key)} · ${counts[o.valor]}`}
                onClick={() => setPagoFiltro(o.valor)}
                style={celdaStyle(activo)}
              >
                <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{counts[o.valor]}</span>
                <span style={{ fontSize: 11, lineHeight: 1.15, textAlign: 'center', color: activo ? colors.primaryFg : colors.subtext }}>{t(o.key)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => abrirHoja('periodo')} style={botonFiltroStyle(periodoFiltro !== 'todo')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{textoPeriodo}</span>
            <Chevron />
          </button>
          <button onClick={() => abrirHoja('turno')} style={botonFiltroStyle(turnoFiltro !== 'todos')}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{textoTurno}</span>
            <Chevron />
          </button>
          <button
            onClick={alternarBusqueda}
            aria-label={t('searchButton')}
            aria-expanded={buscando}
            style={{
              width: 42, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              backgroundColor: colors.surface, border: `1px solid ${buscando || q ? colors.primarySolid : colors.border}`,
              boxShadow: shadows.card, borderRadius: 12,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {buscando && (
          <label style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '0 14px', height: 48 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              autoFocus
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 16, color: colors.text, background: 'transparent' }}
            />
          </label>
        )}

        {resumen.sin_precio_count > 0 && (
          <div style={{ backgroundColor: colors.amberBg, color: colors.amberFg, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4 }}>
            <b>{t('sinPrecioNota', { count: resumen.sin_precio_count })}</b> · {t('sinPrecioEstimado', { monto: monto(resumen.sin_precio_estimado) })}
          </div>
        )}

        {listaBulk.count > 1 && (
          <div>
            <button
              onClick={handleUsarListaEnTodos}
              style={{
                width: '100%', height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                backgroundColor: colors.primarySolid, color: colors.primaryFg, fontSize: 15, fontWeight: 600,
              }}
            >
              {t('useListPriceAll', { count: listaBulk.count })}
            </button>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.subtext, textAlign: 'center' }}>{t('useListPriceAllHint')}</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const items = useMemo<Item[]>(() => {
    const lista: Item[] = [{ tipo: 'encabezado' }];
    if (turnos.length === 0) lista.push({ tipo: cargando ? 'cargando' : 'vacio' });
    else lista.push(...turnos.map((turno): Item => ({ tipo: 'turno', turno })));
    if (cargandoMas) lista.push({ tipo: 'mas' });
    return lista;
  }, [turnos, cargando, cargandoMas]);

  // Al cambiar los filtros las alturas medidas dejan de valer.
  const alturas = useDynamicRowHeight({
    defaultRowHeight: ALTO_ESTIMADO,
    key: `${turnoFiltro}|${pagoFiltro}|${periodoFiltro}|${buscarAplicado}`,
  });

  return (
    <div
      style={{
        height: `calc(100dvh - ${NAV_CLEARANCE}px - env(safe-area-inset-bottom))`,
        backgroundColor: colors.background,
      }}
    >
      <List
        rowComponent={FilaLista}
        rowCount={items.length}
        rowHeight={alturas}
        rowProps={{
          items,
          encabezado,
          atenuado: cargando && turnos.length > 0,
          textoCargando: t('loading'),
          textoVacio: t('emptyState'),
          textoMas: t('loadingMore'),
          profesionalDe: nombreProfesional,
          onUsarLista: handleUsarLista,
          onCargar: cargarConSheet,
        }}
        onRowsRendered={visible => {
          if (visible.stopIndex >= items.length - 3) cargarSiguientePagina();
        }}
        style={{ height: '100%', width: '100%' }}
      />

      {/* Una sola hoja siempre montada: `hoja` conserva el contenido mientras
          desliza hacia abajo y `hojaAbierta` maneja la animación. */}
      <OpcionesSheet
        visible={hojaAbierta}
        titulo={hoja === 'periodo' ? t('periodoTitle') : t('turnoTitle')}
        valor={hoja === 'periodo' ? periodoFiltro : turnoFiltro}
        opciones={
          hoja === 'periodo'
            ? PERIODO_OPCIONES.map(o => ({ valor: o.valor, texto: t(o.key) }))
            : TURNO_OPCIONES.map(o => ({ valor: o.valor, texto: t(o.key) }))
        }
        onElegir={v => {
          if (hoja === 'periodo') setPeriodoFiltro(v as PeriodoFiltro);
          else setTurnoFiltro(v as TurnoFiltro);
          setHojaAbierta(false);
        }}
        onCerrar={() => setHojaAbierta(false)}
      />
    </div>
  );
}

// useSearchParams (filtro inicial desde el banner) exige Suspense en Next.
export default function CobrosPage() {
  return (
    <Suspense fallback={null}>
      <CobrosContenido />
    </Suspense>
  );
}
