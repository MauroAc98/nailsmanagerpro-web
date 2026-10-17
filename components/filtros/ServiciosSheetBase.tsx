'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

// Pieza visual compartida del selector de servicios al FILTRAR: la usan la app
// (`ServiciosSheet`/`SelectorServicios`, modo 'single') y el portal de
// profesionales (`components/pro/ServicioFiltroSheet`). Es presentacional pura:
// recibe todo por props y no lee stores ni servicios (el portal tiene una lista
// permitida de imports, ver `lib/pro/aislamiento.test.ts`). Por eso define su
// propio tipo estructural mínimo y dibuja los íconos como SVG en línea.

export interface ServicioBase {
  id: number;
  nombre: string;
}

export interface GrupoServiciosBase<S extends ServicioBase = ServicioBase> {
  // null = "Sin categoría".
  id: number | null;
  nombre: string;
  servicios: S[];
}

export const botonCabeceraStyle: CSSProperties = {
  minHeight: 44, minWidth: 44, padding: '0 4px', background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
};

// ── Hoja ─────────────────────────────────────────────────────────────────────

interface HojaProps {
  title: string;
  onClose: () => void;
  // Texto del botón de la derecha que cierra; se ignora si hay `trailing`.
  closeLabel?: string;
  // Agregan un botón a la izquierda / reemplazan el de cierre (modo multi).
  leading?: ReactNode;
  trailing?: ReactNode;
  centrarTitulo?: boolean;
  // Pie fijo (CTA).
  footer?: ReactNode;
  children: ReactNode;
  // Capa del fondo oscuro; la hoja usa `zIndex` (o la de BottomSheet si falta).
  backdropZIndex?: number;
  zIndex?: number;
  bottomOffset?: number;
  backdropTestId?: string;
}

// El BottomSheet usa transform: quien necesite una hoja encima de otra debe
// montarla como hermana, no dentro (atraparía un position: fixed).
export function ServiciosHojaBase({
  title, onClose, closeLabel, leading, trailing, centrarTitulo = false, footer, children,
  backdropZIndex = 39, zIndex, bottomOffset, backdropTestId,
}: HojaProps) {
  return (
    <>
      <div
        data-testid={backdropTestId}
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: backdropZIndex, backgroundColor: 'rgba(43, 34, 38, 0.40)' }}
      />
      <BottomSheet
        snapPoints={[0.85]}
        initialIndex={0}
        enablePanDownToClose
        bottomOffset={bottomOffset}
        zIndex={zIndex}
        onChange={index => { if (index < 0) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
        >
          <div style={{
            position: 'sticky', top: 0, zIndex: 1, backgroundColor: colors.surface,
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
          }}>
            {leading}
            <span style={{
              flex: 1, minWidth: 0, textAlign: centrarTitulo ? 'center' : 'left', fontSize: 16, fontWeight: 700, color: colors.textStrong,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
            {trailing || (
              <button type="button" onClick={onClose} style={{ ...botonCabeceraStyle, textAlign: 'right' }}>
                {closeLabel}
              </button>
            )}
          </div>

          <div style={{ flex: 1, padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {children}
          </div>

          {footer}
        </div>
      </BottomSheet>
    </>
  );
}

// ── Lista (selección única) ──────────────────────────────────────────────────

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span aria-hidden="true" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: 20, height: 20, borderRadius: 10, boxSizing: 'border-box',
      border: `2px solid ${selected ? colors.primarySolid : colors.divider}`,
      backgroundColor: colors.surface,
    }}>
      {selected && (
        <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primarySolid }} />
      )}
    </span>
  );
}

function Chevron({ arriba }: { arriba: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={arriba ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

const filaStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
  background: 'none', border: 'none',
};

interface ListaProps<S extends ServicioBase> {
  // Lista plana; se usa cuando `grupos` es null.
  servicios: S[];
  // Agrupado por categoría ya resuelto (null = lista plana sin encabezados).
  grupos: GrupoServiciosBase<S>[] | null;
  seleccionadoId: number | null;
  // id del servicio tocado; null = "Todos".
  onElegir: (id: number | null) => void;
  hideTodos?: boolean;
  todosLabel: string;
  sinCategoriaLabel: string;
  expandLabel: string;
  collapseLabel: string;
  ariaLabel?: string;
  fotoCategoria?: (categoriaId: number) => string | null | undefined;
  // Dato a la derecha de cada servicio.
  detalle?: (servicio: S) => ReactNode;
}

export function ListaServiciosBase<S extends ServicioBase>({
  servicios, grupos, seleccionadoId, onElegir, hideTodos, todosLabel, sinCategoriaLabel,
  expandLabel, collapseLabel, ariaLabel, fotoCategoria, detalle,
}: ListaProps<S>) {
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const toggleColapso = (clave: string) => {
    setColapsadas(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  const renderFila = (s: S) => (
    <button
      key={s.id}
      type="button"
      role="radio"
      aria-checked={seleccionadoId === s.id}
      onClick={() => onElegir(s.id)}
      style={filaStyle}
    >
      <RadioIndicator selected={seleccionadoId === s.id} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: colors.text,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{s.nombre}</span>
      {detalle?.(s)}
    </button>
  );

  const filaTodos = !hideTodos && (
    <button type="button" role="radio" aria-checked={seleccionadoId === null} onClick={() => onElegir(null)} style={filaStyle}>
      <RadioIndicator selected={seleccionadoId === null} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>
        {todosLabel}
      </span>
    </button>
  );

  const tarjeta: CSSProperties = {
    borderRadius: 16, border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface, boxShadow: shadows.card, overflow: 'hidden',
  };

  if (grupos === null) {
    return (
      <div role="radiogroup" aria-label={ariaLabel} style={tarjeta}>
        <div style={{ padding: '4px 8px 8px' }}>
          {filaTodos}
          {servicios.map(renderFila)}
        </div>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} style={tarjeta}>
      <div style={{ padding: '4px 8px 0' }}>
        {filaTodos}
      </div>
      {grupos.map(grupo => {
        const clave = grupo.id === null ? 'sin-categoria' : String(grupo.id);
        const expandida = !colapsadas.has(clave);
        const foto = grupo.id !== null ? fotoCategoria?.(grupo.id) : null;
        return (
          <div key={clave} style={{ borderTop: `1px solid ${colors.hairline}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <button
                type="button"
                onClick={() => toggleColapso(clave)}
                aria-expanded={expandida}
                aria-label={expandida ? collapseLabel : expandLabel}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                }}
              >
                {foto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
                  textTransform: 'uppercase', color: colors.subtext,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {grupo.id === null ? sinCategoriaLabel : grupo.nombre}
                </span>
                <Chevron arriba={expandida} />
              </button>
            </div>
            {expandida && (
              <div style={{ padding: '0 8px 8px' }}>
                {grupo.servicios.map(renderFila)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
