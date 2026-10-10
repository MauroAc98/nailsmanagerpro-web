'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { adminService, UsoNegocioResumen } from '@/services/adminService';
import { FiltroPills } from '@/components/FiltroPills';
import { Spinner } from '@/components/Spinner';
import { diasDesde, esNegocioActivo, formatUltimoTurno, textoDias } from '@/lib/usoFechas';

type Estado = 'todos' | 'activos' | 'inactivos';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

export default function UsoPage() {
  const [negocios, setNegocios] = useState<UsoNegocioResumen[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState<Estado>('todos');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await adminService.obtenerUsoResumen();
      setNegocios(data.negocios);
    } catch (e: unknown) {
      setNegocios(null);
      setError(extraerMensajeError(e, 'No se pudo cargar el uso por negocio.'));
    } finally {
      setCargando(false);
    }
  }, []);

  // Fetch inicial al montar (mismo criterio que SuscripcionesPage).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  // El orden lo da la API (nunca agendó primero, luego el último turno más viejo).
  const filas = useMemo(() => {
    if (!negocios) return [];
    const q = sinTildes(buscar.trim());
    return negocios
      .map(n => ({ n, dias: diasDesde(n.ultimo_turno_epoch) }))
      .filter(({ n, dias }) => {
        if (estado === 'activos' && !esNegocioActivo(dias)) return false;
        if (estado === 'inactivos' && esNegocioActivo(dias)) return false;
        return !q || sinTildes(n.nombre ?? `Negocio #${n.user_id}`).includes(q);
      });
  }, [negocios, buscar, estado]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, color: colors.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 0' }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, fontSize: 14, color: colors.subtext, textDecoration: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.subtext} strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Panel
          </Link>
        </div>

        <div style={{ padding: '4px 20px 12px' }}>
          <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>Uso de la app</h1>
        </div>

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
              placeholder="Buscar negocio"
              aria-label="Buscar negocio"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
            />
            {buscar && (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setBuscar('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          <FiltroPills
            ariaLabel="Filtrar por actividad"
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'activos', label: 'Activos' },
              { value: 'inactivos', label: 'Inactivos' },
            ]}
            value={estado}
            onChange={setEstado}
          />
        </div>

        <div style={{ padding: '0 20px 32px' }}>
          {cargando && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Spinner size={32} label="Cargando negocios" />
            </div>
          )}

          {!cargando && error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
              <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
              <button
                type="button"
                onClick={cargar}
                style={{ alignSelf: 'flex-start', padding: '8px 14px', minHeight: 36, borderRadius: 10, border: `1px solid ${colors.dangerBorder}`, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && negocios !== null && filas.length === 0 && (
            <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0', margin: 0 }}>No hay negocios para mostrar.</p>
          )}

          {!cargando && !error && filas.length > 0 && (
            <>
              <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 8px 4px' }}>
                {`${filas.length} ${filas.length === 1 ? 'negocio' : 'negocios'} · días desde su último turno, los más antiguos primero`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filas.map(({ n, dias }) => {
                  const { numero, unidad } = textoDias(dias);
                  return (
                    <Link
                      key={n.user_id}
                      href={`/uso/${n.user_id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box',
                        padding: '14px 16px', borderRadius: 14, textDecoration: 'none',
                        backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.nombre ?? `Negocio #${n.user_id}`}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.ultimo_turno_epoch === null ? 'Nunca agendó un turno' : `Último turno: ${formatUltimoTurno(n.ultimo_turno_epoch)}`}
                        </p>
                      </div>
                      <div style={{ flexShrink: 0, minWidth: 48, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: colors.textStrong, whiteSpace: 'nowrap' }}>{numero}</span>
                        {unidad && <span style={{ marginTop: 4, fontSize: 11, color: colors.subtext }}>{unidad}</span>}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
