'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { MontoFit } from '@/components/estadisticas/MontoFit';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { NAV_CLEARANCE } from '@/constants/layout';
import { formatMontoCorto } from '@/lib/money';
import { estimadoAPrecioDeLista, tienePrecioDeListaCompleto } from '@/lib/pendientesDeCobro';
import {
  armarFilas,
  filtrarFilas,
  parsePagoFiltro,
  resumir,
  type CobroFila,
  type EstadoPago,
  type PagoFiltro,
  type TurnoFiltro,
} from '@/lib/cobros';
import { useCobrosStore } from '@/store/useCobrosStore';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { Turno } from '@/services/turnoService';

const monto = (n: number) => `$${formatMontoCorto(n)}`;

function formatFechaHora(fechaHora: string): string {
  const d = new Date(fechaHora.replace(' ', 'T'));
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

const nombreCliente = (turno: Turno) => `${turno.cliente.nombre} ${turno.cliente.apellido}`.trim();

const TURNO_OPCIONES: { valor: TurnoFiltro; key: 'turnoTodos' | 'turnoConfirmados' | 'turnoFinalizados' }[] = [
  { valor: 'todos', key: 'turnoTodos' },
  { valor: 'confirmado', key: 'turnoConfirmados' },
  { valor: 'finalizado', key: 'turnoFinalizados' },
];
const PAGO_OPCIONES: { valor: PagoFiltro; key: 'pagoTodos' | 'pagoSena' | 'pagoTodo' | 'pagoNada' | 'pagoSinPrecio' }[] = [
  { valor: 'todos', key: 'pagoTodos' },
  { valor: 'sena', key: 'pagoSena' },
  { valor: 'todo', key: 'pagoTodo' },
  { valor: 'nada', key: 'pagoNada' },
  { valor: 'sinprecio', key: 'pagoSinPrecio' },
];
const PILL_PAGO_KEY: Record<EstadoPago, 'pillSena' | 'pillTodo' | 'pillNada' | 'pillSinPrecio'> = {
  sena: 'pillSena',
  todo: 'pillTodo',
  nada: 'pillNada',
  sinprecio: 'pillSinPrecio',
};
const TONO_PAGO: Record<EstadoPago, 'ok' | 'warn' | 'none'> = { sena: 'warn', todo: 'ok', nada: 'none', sinprecio: 'warn' };

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

function Chips<T extends string>({
  label, opciones, valor, onChange,
}: { label: string; opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="group" aria-label={label}>
      <span style={{ fontSize: 11.5, letterSpacing: '.07em', textTransform: 'uppercase', color: colors.subtext }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opciones.map(o => {
          const activo = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(o.valor)}
              style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
                fontWeight: activo ? 700 : 500,
                border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
                backgroundColor: activo ? colors.primarySolid : colors.surface,
                color: activo ? colors.primaryFg : colors.text,
              }}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FilaProps {
  fila: CobroFila;
  profesional: string | null;
  precioLista: number;
  puedeUsarLista: boolean;
  onUsarLista: () => void;
  onCargar: () => void;
}

function FilaCobro({ fila, profesional, precioLista, puedeUsarLista, onUsarLista, onCargar }: FilaProps) {
  const t = useTranslations('agenda.CobrosPage');
  const { turno } = fila;
  const servicios = turno.servicios.map(s => s.nombre).join(', ');
  const detalle = [servicios, formatFechaHora(turno.fecha_hora), profesional ? t('conProfesional', { nombre: profesional }) : null]
    .filter(Boolean)
    .join(' · ');

  let principal: string;
  let secundario: string;
  if (fila.pago === 'sinprecio') {
    principal = puedeUsarLista ? t('listaMonto', { monto: monto(precioLista) }) : t('sinPrecioLista');
    secundario = fila.sena > 0 ? t('senaMonto', { monto: monto(fila.sena) }) : '';
  } else if (fila.finalizado) {
    principal = monto(fila.cobrado ?? 0);
    secundario = fila.sena > 0 ? `${t('cobrado')} · ${t('senaMonto', { monto: monto(fila.sena) })}` : t('cobrado');
  } else if (fila.senaCompartida) {
    principal = monto(fila.sena);
    secundario = t('senaDelGrupo');
  } else {
    principal = monto(fila.sena);
    secundario = fila.faltaFila != null ? t('faltaMonto', { monto: monto(fila.faltaFila) }) : '';
  }

  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombreCliente(turno)}
          </div>
          <div style={{ fontSize: 13, color: colors.subtext, marginTop: 2, overflowWrap: 'anywhere' }}>{detalle}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            <Pill tono={fila.finalizado ? 'ok' : 'none'}>{fila.finalizado ? t('pillFinalizado') : t('pillConfirmado')}</Pill>
            <Pill tono={TONO_PAGO[fila.pago]}>{t(PILL_PAGO_KEY[fila.pago])}</Pill>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>{principal}</div>
          {secundario && <div style={{ fontSize: 12.5, color: colors.subtext, whiteSpace: 'nowrap', marginTop: 2 }}>{secundario}</div>}
        </div>
      </div>
      {fila.pago === 'sinprecio' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {puedeUsarLista && (
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

function CobrosContenido() {
  const t = useTranslations('agenda.CobrosPage');
  const searchParams = useSearchParams();
  const { turnos, loading, error, fetchCobros } = useCobrosStore();
  const { actualizarPrecios } = usePendientesDeCobroStore();
  const { servicios, fetchServicios } = useServiciosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const [turnoFiltro, setTurnoFiltro] = useState<TurnoFiltro>('todos');
  const [pagoFiltro, setPagoFiltro] = useState<PagoFiltro>(() => parsePagoFiltro(searchParams.get('pago')));
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchCobros();
    fetchServicios();
    if (profesionales.length === 0) fetchProfesionales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const referencias = useMemo(() => new Map(servicios.map(s => [s.id, s.precio])), [servicios]);
  const filas = useMemo(() => armarFilas(turnos, referencias), [turnos, referencias]);
  const visibles = useMemo(
    () => filtrarFilas(filas, { turno: turnoFiltro, pago: pagoFiltro, q }),
    [filas, turnoFiltro, pagoFiltro, q],
  );
  const resumen = useMemo(() => resumir(visibles, referencias), [visibles, referencias]);
  const nombreProfesional = (id?: number | null) => {
    const p = id != null ? profesionales.find(x => x.id === id) : undefined;
    return p ? p.nombre : null;
  };

  const guardar = async (turno: Turno, precios: { servicio_id: number; precio: number }[]) => {
    const result = await actualizarPrecios(turno.id, precios);
    if (result.success) {
      showToast(t('saved'));
      await fetchCobros();
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
    return result.success;
  };

  const cargarConSheet = async (turno: Turno): Promise<boolean> => {
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

  const handleUsarLista = async (turno: Turno) => {
    const total = monto(estimadoAPrecioDeLista(turno, referencias));
    // Es dato de plata y no hay "deshacer" desde acá: confirmación breve.
    const ok = await confirmDialog(t('confirmUseListPrice', { cliente: nombreCliente(turno), monto: total }), {
      confirmText: t('confirmUseListPriceButton'),
    });
    if (!ok) return;
    await guardar(turno, turno.servicios.map(s => ({ servicio_id: s.id, precio: Number(referencias.get(s.id)) })));
  };

  // Registro en bloque a precio de lista: solo sobre los "falta cargar el
  // precio" visibles cuyos servicios tienen todos precio de lista.
  const conPrecioDeLista = useMemo(
    () => visibles.filter(f => f.pago === 'sinprecio' && tienePrecioDeListaCompleto(f.turno, referencias)),
    [visibles, referencias],
  );
  const totalDeLista = useMemo(
    () => conPrecioDeLista.reduce((acc, f) => acc + estimadoAPrecioDeLista(f.turno, referencias), 0),
    [conPrecioDeLista, referencias],
  );

  const handleUsarListaEnTodos = async () => {
    const lote = conPrecioDeLista.map(f => f.turno); // snapshot
    const ok = await confirmDialog(
      t('confirmUseListPriceAll', { count: lote.length, monto: monto(totalDeLista) }),
      { confirmText: t('confirmUseListPriceButton') },
    );
    if (!ok) return;

    let hechos = 0;
    for (const turno of lote) {
      const result = await actualizarPrecios(
        turno.id,
        turno.servicios.map(s => ({ servicio_id: s.id, precio: Number(referencias.get(s.id)) })),
      );
      if (!result.success) {
        await fetchCobros();
        await alertDialog(t('bulkPartialError', { done: hechos, total: lote.length, error: result.message ?? t('saveError') }));
        return;
      }
      hechos += 1;
    }
    showToast(t('bulkSaved', { count: hechos }));
    await fetchCobros();
  };

  const tiles: { label: string; valor: number; destacado?: boolean }[] = [
    { label: t('summarySena'), valor: resumen.senaCobrada },
    { label: t('summaryCobrado'), valor: resumen.cobradoFinalizados },
    { label: t('summaryFalta'), valor: resumen.faltaCobrar, destacado: true },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: NAV_CLEARANCE + 24 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        <p style={{ fontSize: 14, color: colors.subtext, margin: '4px 0 0' }}>{t('subtitle')}</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }} aria-live="polite">
          {tiles.map(tile => (
            <div
              key={tile.label}
              style={{
                backgroundColor: tile.destacado ? colors.amberBg : colors.surface, border: `1px solid ${colors.border}`,
                boxShadow: shadows.card, borderRadius: 14, padding: 10, minWidth: 0,
              }}
            >
              <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.25, color: colors.subtext }}>{tile.label}</span>
              <div style={{ marginTop: 4, minWidth: 0, fontFamily: agendaFontSerif, color: colors.textStrong }}>
                <MontoFit maxFontSize={17} minFontSize={11}>{monto(tile.valor)}</MontoFit>
              </div>
            </div>
          ))}
        </div>

        {resumen.sinPrecioCount > 0 && (
          <div style={{ backgroundColor: colors.amberBg, color: colors.amberFg, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4 }}>
            <b>{t('sinPrecioNota', { count: resumen.sinPrecioCount })}</b> · {t('sinPrecioEstimado', { monto: monto(resumen.sinPrecioEstimado) })}
          </div>
        )}

        {conPrecioDeLista.length > 1 && (
          <div>
            <button
              onClick={handleUsarListaEnTodos}
              style={{
                width: '100%', height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                backgroundColor: colors.primarySolid, color: colors.primaryFg, fontSize: 15, fontWeight: 600,
              }}
            >
              {t('useListPriceAll', { count: conPrecioDeLista.length })}
            </button>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.subtext, textAlign: 'center' }}>{t('useListPriceAllHint')}</p>
          </div>
        )}

        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 12, padding: '0 14px', height: 48,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 16, color: colors.text, background: 'transparent' }}
          />
        </label>

        <Chips
          label={t('filterTurno')}
          valor={turnoFiltro}
          onChange={setTurnoFiltro}
          opciones={TURNO_OPCIONES.map(o => ({ valor: o.valor, texto: t(o.key) }))}
        />
        <Chips
          label={t('filterPago')}
          valor={pagoFiltro}
          onChange={setPagoFiltro}
          opciones={PAGO_OPCIONES.map(o => ({ valor: o.valor, texto: t(o.key) }))}
        />

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        {loading && turnos.length === 0 ? (
          <p style={{ color: colors.subtext, fontSize: 15, textAlign: 'center', padding: '24px 0' }}>{t('loading')}</p>
        ) : visibles.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '22px 0', color: colors.subtext, fontSize: 14 }}>{t('emptyState')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibles.map(fila => (
              <FilaCobro
                key={fila.turno.id}
                fila={fila}
                profesional={nombreProfesional(fila.turno.profesional_id)}
                precioLista={estimadoAPrecioDeLista(fila.turno, referencias)}
                puedeUsarLista={tienePrecioDeListaCompleto(fila.turno, referencias)}
                onUsarLista={() => handleUsarLista(fila.turno)}
                onCargar={() => cargarConSheet(fila.turno)}
              />
            ))}
          </div>
        )}
      </div>
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
