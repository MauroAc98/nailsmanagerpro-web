'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { NAV_CLEARANCE, NAV_BUBBLE_POKE } from '@/constants/layout';
import { formatMontoCorto } from '@/lib/money';
import {
  agruparPorSemana,
  estimadoAPrecioDeLista,
  ordenarPendientes,
  tienePrecioDeListaCompleto,
  type GrupoSemana,
  type OrdenPendientes,
} from '@/lib/pendientesDeCobro';
import { usePendientesDeCobroStore, usePendientesFiltrados } from '@/store/usePendientesDeCobroStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { showToast } from '@/store/useToastStore';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { Turno } from '@/services/turnoService';

function formatFechaHora(fechaHora: string): string {
  const d = new Date(fechaHora.replace(' ', 'T'));
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

const nombreCliente = (turno: Turno) => `${turno.cliente.nombre} ${turno.cliente.apellido}`.trim();

const GRUPO_KEY: Record<GrupoSemana, 'groupThisWeek' | 'groupLastWeek' | 'groupOlder'> = {
  estaSemana: 'groupThisWeek',
  semanaPasada: 'groupLastWeek',
  anteriores: 'groupOlder',
};

interface PendienteCardProps {
  turno: Turno;
  precioLista: number;
  puedeUsarLista: boolean;
  onUsarLista: () => void;
  onCargar: () => void;
}

function PendienteCard({ turno, precioLista, puedeUsarLista, onUsarLista, onCargar }: PendienteCardProps) {
  const t = useTranslations('agenda.PendientesDeCobroPage');
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, minWidth: 0 }}>
          {nombreCliente(turno)}
        </p>
        <span style={{ fontSize: 13, color: colors.subtext, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatFechaHora(turno.fecha_hora)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: colors.subtext }}>
        {turno.servicios.map(s => s.nombre).join(', ')}
      </p>

      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text }}>
        {puedeUsarLista ? t('listPrice', { monto: `$${formatMontoCorto(precioLista)}` }) : t('noListPrice')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {puedeUsarLista && (
          <button
            onClick={onUsarLista}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('useListPrice')}
          </button>
        )}
        <button
          onClick={onCargar}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: colors.primarySolid,
            color: '#FFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('loadPrice')}
        </button>
      </div>
    </div>
  );
}

export default function PendientesDeCobroPage() {
  const t = useTranslations('agenda.PendientesDeCobroPage');
  const { loading, error, buscar, setBuscar, fetchPendientes, actualizarPrecios } = usePendientesDeCobroStore();
  const pendientesFiltrados = usePendientesFiltrados();
  const { servicios, fetchServicios } = useServiciosStore();
  const [orden, setOrden] = useState<OrdenPendientes>('antiguos');

  useEffect(() => {
    fetchPendientes();
    fetchServicios();
  }, []);

  const referencias = useMemo(() => new Map(servicios.map(s => [s.id, s.precio])), [servicios]);
  const ordenados = useMemo(() => ordenarPendientes(pendientesFiltrados, orden), [pendientesFiltrados, orden]);
  const grupos = useMemo(() => agruparPorSemana(ordenados), [ordenados]);
  const estimadoTotal = useMemo(
    () => ordenados.reduce((acc, turno) => acc + estimadoAPrecioDeLista(turno, referencias), 0),
    [ordenados, referencias]
  );

  const guardar = async (turno: Turno, precios: { servicio_id: number; precio: number }[]) => {
    const result = await actualizarPrecios(turno.id, precios);
    if (result.success) showToast(t('saved'));
    else await alertDialog(result.message ?? t('saveError'));
    return result.success;
  };

  // Abre el sheet para un turno. Devuelve false si se canceló o falló el
  // guardado, para que el encadenado ("Cargar de a uno") se detenga.
  const cargarConSheet = async (turno: Turno): Promise<boolean> => {
    const serviciosAPrecificar = turno.servicios.map(s => {
      const ref = referencias.get(s.id);
      return {
        servicio_id: s.id,
        nombre: s.nombre,
        precioReferencia: ref != null && ref !== '' ? Number(ref) : null,
      };
    });

    const precios = await pedirPreciosServicios(serviciosAPrecificar, {
      cliente: nombreCliente(turno),
      fechaHora: turno.fecha_hora,
      modo: 'cargar',
    });
    if (!precios) return false;
    return guardar(turno, precios);
  };

  const handleUsarLista = async (turno: Turno) => {
    const monto = `$${formatMontoCorto(estimadoAPrecioDeLista(turno, referencias))}`;
    // Es dato de plata y no hay "deshacer" desde acá: confirmación breve.
    const ok = await confirmDialog(t('confirmUseListPrice', { cliente: nombreCliente(turno), monto }), {
      confirmText: t('confirmUseListPriceButton'),
    });
    if (!ok) return;
    await guardar(
      turno,
      turno.servicios.map(s => ({ servicio_id: s.id, precio: Number(referencias.get(s.id)) }))
    );
  };

  const handleCargarDeAUno = async () => {
    // Snapshot: el store va quitando turnos a medida que se guardan.
    for (const turno of [...ordenados]) {
      if (!(await cargarConSheet(turno))) return;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: NAV_CLEARANCE + 110 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas), sin el indent de
          48px que alineaba el subtítulo contra el BackButton inline. */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        <p style={{ fontSize: 14, color: colors.subtext, margin: '4px 0 0' }}>{t('subtitle')}</p>
      </div>

      {!loading && ordenados.length > 0 && (
        <div style={{ padding: '0 20px 12px' }}>
          <div
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.card,
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: colors.subtext }}>{t('summaryLabel')}</p>
            <p style={{ margin: '2px 0 0', fontFamily: agendaFontSerif, fontSize: 28, color: colors.textStrong }}>
              ${formatMontoCorto(estimadoTotal)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: colors.subtext }}>
              {t('resultCount', { count: ordenados.length })} · {t('summaryEstimated')}
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
          />
          {buscar && (
            <button onClick={() => setBuscar('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8,
          backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`,
        }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordenados.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {(['antiguos', 'recientes'] as const).map(valor => {
                const activo = orden === valor;
                return (
                  <button
                    key={valor}
                    onClick={() => setOrden(valor)}
                    aria-pressed={activo}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
                      backgroundColor: activo ? colors.primarySolid : colors.surface,
                      color: activo ? '#FFF' : colors.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t(valor === 'antiguos' ? 'sortOldest' : 'sortNewest')}
                  </button>
                );
              })}
            </div>
          )}

          {ordenados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {buscar ? t('noResults') : t('emptyState')}
            </p>
          ) : (
            grupos.map(({ grupo, turnos }) => (
              <div key={grupo + turnos[0].id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: '6px 0 0 4px', fontSize: 13, fontWeight: 700, color: colors.subtext }}>
                  {t(GRUPO_KEY[grupo], { count: turnos.length })}
                </p>
                {turnos.map(turno => (
                  <PendienteCard
                    key={turno.id}
                    turno={turno}
                    precioLista={estimadoAPrecioDeLista(turno, referencias)}
                    puedeUsarLista={tienePrecioDeListaCompleto(turno, referencias)}
                    onUsarLista={() => handleUsarLista(turno)}
                    onCargar={() => cargarConSheet(turno)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {!loading && ordenados.length > 1 && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: `calc(${NAV_CLEARANCE + NAV_BUBBLE_POKE + 12}px + env(safe-area-inset-bottom))`,
            padding: '0 20px',
            zIndex: 10,
          }}
        >
          <button
            onClick={handleCargarDeAUno}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              backgroundColor: colors.primarySolid,
              color: '#FFF',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: shadows.card,
            }}
          >
            {t('loadOneByOne', { count: ordenados.length })}
          </button>
        </div>
      )}
    </div>
  );
}
