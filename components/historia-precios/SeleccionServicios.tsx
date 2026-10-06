'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import { formatoPrecioTarjeta } from '@/lib/formatoPrecioTarjeta';
import {
  agruparParaSeleccion,
  contarSeleccionados,
  quitarTodo,
  seleccionarTodo,
  toggleCategoria,
  toggleServicio,
  type EstadoSeleccion,
  type ExcluidosHistoria,
} from '@/lib/historiaSeleccion';

interface Props {
  // Servicios activos de la profesional (ANTES de filtrar por selección).
  servicios:  Servicio[];
  categorias: CategoriaServicio[];
  excluidos:  ExcluidosHistoria;
  onChange:   (next: Set<number>) => void;
  // La tarjeta no entra en una sola imagen ni con la densidad más compacta
  // (ver TarjetaPrecios/onFitChange): se avisa en ámbar.
  noEntra?:   boolean;
}

function Caja({ estado, size }: { estado: EstadoSeleccion; size: number }) {
  const activo = estado !== 'none';
  return (
    <span aria-hidden style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: size, height: size, borderRadius: 7,
      border: `2px solid ${activo ? colors.primarySolid : colors.divider}`,
      backgroundColor: activo ? colors.primarySolid : colors.surface,
      color: colors.primaryFg,
    }}>
      {estado === 'all' && <Check size={size - 10} strokeWidth={3} />}
      {estado === 'some' && <Minus size={size - 10} strokeWidth={3} />}
    </span>
  );
}

export function SeleccionServicios({ servicios, categorias, excluidos, onChange, noEntra = false }: Props) {
  const t = useTranslations('historia.HistoriaPreciosPage');
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set());

  const grupos = useMemo(
    () => agruparParaSeleccion(servicios, categorias, excluidos),
    [servicios, categorias, excluidos]
  );

  const total = servicios.length;
  const marcados = contarSeleccionados(servicios, excluidos);
  const todoElegido = marcados === total;
  const hayGrupoSinCategoria = grupos.some(g => g.id === null);

  const toggleAbierta = (clave: string) =>
    setAbiertas(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });

  return (
    <div style={{ width: '100%', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{t('seleccionTitle')}</p>
        <button
          type="button"
          onClick={() => onChange(todoElegido ? quitarTodo(servicios) : seleccionarTodo())}
          style={{
            minHeight: 44, padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer',
            color: colors.primaryDeep, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {todoElegido ? t('seleccionQuitarTodo') : t('seleccionElegirTodo')}
        </button>
      </div>

      <span style={{ fontSize: 12.5, lineHeight: 1.4, color: colors.subtext }}>
        {t('seleccionContador', { marcados, total })}
      </span>

      {noEntra && (
        <span style={{
          fontSize: 12.5, lineHeight: 1.4, padding: '8px 12px', borderRadius: 10,
          background: colors.amberBg, color: colors.amberFg,
        }}>
          {t('seleccionNoEntra')}
        </span>
      )}

      <div style={{
        background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {grupos.map((grupo, i) => {
          const clave = grupo.id === null ? 'sin-categoria' : String(grupo.id);
          const abierta = abiertas.has(clave);
          const nombre = grupo.id === null ? t('seleccionSinCategoria') : grupo.nombre;
          const ids = grupo.servicios.map(s => s.id);
          return (
            <div key={clave} style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}` }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  aria-label={t('seleccionCategoriaAria', { nombre })}
                  aria-pressed={grupo.estado === 'some' ? 'mixed' : grupo.estado === 'all'}
                  onClick={() => onChange(toggleCategoria(excluidos, ids, grupo.estado))}
                  style={{
                    width: 48, height: 48, flexShrink: 0, border: 'none', background: 'none', padding: 0,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Caja estado={grupo.estado} size={24} />
                </button>
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => toggleAbierta(clave)}
                  style={{
                    flex: 1, minWidth: 0, minHeight: 48, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', padding: '0 14px 0 0', cursor: 'pointer',
                    color: colors.text, textAlign: 'left', font: 'inherit',
                  }}
                >
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{nombre}</span>
                  <span style={{ fontSize: 13, color: colors.subtext, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {t('seleccionCategoriaCuenta', { marcados: grupo.marcados, total: grupo.total })}
                  </span>
                  <ChevronDown
                    size={16}
                    color={colors.subtext}
                    strokeWidth={2.5}
                    style={{ flexShrink: 0, transform: abierta ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
              </div>

              {abierta && grupo.servicios.map(s => {
                const marcado = !excluidos.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => onChange(toggleServicio(excluidos, s.id))}
                    style={{
                      width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', padding: '0 14px 0 20px', cursor: 'pointer',
                      color: marcado ? colors.text : colors.subtext, textAlign: 'left', font: 'inherit',
                    }}
                  >
                    <Caja estado={marcado ? 'all' : 'none'} size={22} />
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 14,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.nombre}</span>
                    {s.es_promo && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0,
                        background: colors.surfaceSubtle, color: colors.primaryDeep, borderRadius: 6, padding: '2px 6px',
                      }}>{t('seleccionPromo')}</span>
                    )}
                    <span style={{ fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatoPrecioTarjeta(s.precio)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {hayGrupoSinCategoria && (
        <span style={{ fontSize: 12, lineHeight: 1.4, color: colors.subtext }}>
          {t('seleccionHintSinCategoria')}
        </span>
      )}
    </div>
  );
}
