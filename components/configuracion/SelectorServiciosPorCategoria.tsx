'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronUp, Minus, Search } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import type { Servicio } from '@/services/servicioService';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';
import { deriveEstadoCategoria, type EstadoCategoria } from '@/lib/deriveEstadoCategoria';

interface Props {
  servicios: Servicio[];
  // Set COMPLETO de ids asignados a la profesional, incluidos los de
  // servicios inactivos (invisibles acá) — ver contrato en la proposal.
  servicioIds: number[];
  // Recibe siempre el set COMPLETO nuevo, nunca un delta — un tick de
  // categoría es una mutación en bloque, no un toggle por id.
  onChange: (nextIds: number[]) => void;
}

function EstadoCheckbox({ estado }: { estado: EstadoCategoria }) {
  const activo = estado !== 'unchecked';
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: 20, height: 20, borderRadius: 6,
      border: `2px solid ${activo ? colors.primarySolid : colors.divider}`,
      backgroundColor: activo ? colors.primarySolid : colors.surface,
      color: colors.primaryFg,
    }}>
      {estado === 'checked' && <Check size={13} strokeWidth={3} />}
      {estado === 'indeterminate' && <Minus size={13} strokeWidth={3} />}
    </span>
  );
}

function ServicioCheckbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: 20, height: 20, borderRadius: 6,
      border: `2px solid ${checked ? colors.primarySolid : colors.divider}`,
      backgroundColor: checked ? colors.primarySolid : colors.surface,
      color: colors.primaryFg,
    }}>
      {checked && <Check size={13} strokeWidth={3} />}
    </span>
  );
}

// Picker de servicios agrupado por categoría con checkbox de categoría
// tri-estado derivado — reemplaza el flat-list duplicado en
// profesionales/nuevo y profesionales/[id] (ver proposal). Controlado: el
// padre es dueño de `servicioIds`; este componente solo emite el set
// completo nuevo vía `onChange`. Standalone en este PR — todavía no se
// referencia desde ninguna pantalla (eso es PR 3).
export function SelectorServiciosPorCategoria({ servicios, servicioIds, onChange }: Props) {
  const t = useTranslations('configuracion.SelectorServiciosPorCategoria');

  // Mismo patrón que configuracion/servicios/page.tsx: `categoriasReady`
  // distingue "todavía no cargó" de "cargó y no hay categorías" (evita el
  // flash de "Sin categoría" prohibido por el spec).
  const { categorias, fetchCategorias } = useCategoriasServicioStore();
  const [categoriasReady, setCategoriasReady] = useState(false);
  useEffect(() => { fetchCategorias().finally(() => setCategoriasReady(true)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filtro, setFiltro] = useState('');
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  // Solo los servicios activos son visibles/seleccionables acá — los
  // inactivos ya asignados (pueden estar en `servicioIds`) nunca se
  // renderizan, nunca entran en `agruparServiciosPorCategoria` y por lo
  // tanto nunca participan del cálculo tri-estado ni de las mutaciones de
  // categoría (ver `handleToggleCategoria`).
  const serviciosActivos = useMemo(() => servicios.filter(s => s.activo), [servicios]);
  const grupos = useMemo(
    () => agruparServiciosPorCategoria(serviciosActivos, categorias),
    [serviciosActivos, categorias]
  );
  // Anti-regresión (spec: "Zero-Category Fallback"): si ninguna cuenta
  // categorizó servicios todavía, se renderiza como lista plana sin
  // headers — mismo criterio que configuracion/servicios/page.tsx.
  const hayServicioCategorizado = serviciosActivos.some(s => s.categoria_id !== null);

  const filtroNormalizado = filtro.trim().toLowerCase();
  const coincide = (s: Servicio) => s.nombre.toLowerCase().includes(filtroNormalizado);
  const claveGrupo = (id: number | null) => (id === null ? 'sin-categoria' : String(id));

  const toggleServicio = (id: number) => {
    onChange(servicioIds.includes(id) ? servicioIds.filter(i => i !== id) : [...servicioIds, id]);
  };

  // CRÍTICO (spec: "Inactive Assigned Services Are Never Touched by
  // Category Actions" + "Category State and Actions Ignore the Text
  // Filter"): `activosIds` viene SIEMPRE de `grupo.servicios` — ya
  // filtrado a solo activos por `agruparServiciosPorCategoria`, y NUNCA
  // recortado por `filtroNormalizado`. Cualquier id fuera de `activosIds`
  // (inactivo de esta misma categoría, o de cualquier otra categoría)
  // nunca se lee ni se toca acá.
  const handleToggleCategoria = (activosIds: number[], estado: EstadoCategoria) => {
    if (estado === 'checked') {
      onChange(servicioIds.filter(id => !activosIds.includes(id)));
    } else {
      // unchecked o indeterminate -> siempre selecciona todo (spec: "never
      // cleared" al clickear en indeterminado).
      const seleccionados = new Set(servicioIds);
      const agregados = activosIds.filter(id => !seleccionados.has(id));
      onChange([...servicioIds, ...agregados]);
    }
  };

  const toggleColapso = (clave: string) => {
    setColapsadas(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  // Evita el flash: mientras las categorías no asentaron, no sabemos si el
  // fallback plano aplica o no.
  if (!categoriasReady) return null;

  if (serviciosActivos.length === 0) {
    return (
      <p style={{ fontSize: 13, color: colors.subtext, margin: '4px 0 0 2px' }}>
        {t('noActiveServices')}
      </p>
    );
  }

  const renderFila = (s: Servicio) => (
    <div
      key={s.id}
      onClick={() => toggleServicio(s.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
      }}
    >
      <ServicioCheckbox checked={servicioIds.includes(s.id)} />
      <span style={{ flex: 1, fontSize: 14, color: colors.text }}>{s.nombre}</span>
      <span style={{ fontSize: 12, color: colors.subtext, flexShrink: 0 }}>{s.duracion_minutos} min</span>
    </div>
  );

  const buscador = (
    <div style={{ padding: 10, borderBottom: `1px solid ${colors.hairline}`, position: 'relative' }}>
      <Search size={16} strokeWidth={2} color={colors.muted} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        placeholder={t('filterPlaceholder')}
        style={{
          width: '100%', height: 40, borderRadius: 10, border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceSubtle, color: colors.text,
          padding: '0 12px 0 34px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );

  if (!hayServicioCategorizado) {
    // Fallback plano: sin categorías reales en uso todavía, ni headers ni
    // "Sin categoría" — vista idéntica a un checklist simple.
    const visibles = filtroNormalizado ? serviciosActivos.filter(coincide) : serviciosActivos;
    return (
      <div style={{
        borderRadius: 16, border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface, boxShadow: shadows.card, overflow: 'hidden',
      }}>
        {buscador}
        <div style={{ padding: '4px 8px 8px' }}>
          {visibles.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: colors.subtext, margin: 0 }}>
              {t('noResults')}
            </p>
          ) : visibles.map(renderFila)}
        </div>
      </div>
    );
  }

  // El checkbox y las acciones de categoría siempre operan sobre
  // `grupo.servicios` (activos, sin filtrar por texto) — `visibles` solo
  // decide qué filas se muestran, nunca qué ids toca la categoría (ver
  // handleToggleCategoria arriba, y spec: "Category State and Actions
  // Ignore the Text Filter").
  const secciones = grupos
    .map(grupo => {
      const activosIds = grupo.servicios.map(s => s.id);
      const visibles = filtroNormalizado ? grupo.servicios.filter(coincide) : grupo.servicios;
      return { grupo, activosIds, visibles };
    })
    .filter(({ visibles }) => !filtroNormalizado || visibles.length > 0);

  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${colors.border}`,
      backgroundColor: colors.surface, boxShadow: shadows.card, overflow: 'hidden',
    }}>
      {buscador}
      {secciones.length === 0 ? (
        <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: colors.subtext, margin: 0 }}>
          {t('noResults')}
        </p>
      ) : secciones.map(({ grupo, activosIds, visibles }, index) => {
        const clave = claveGrupo(grupo.id);
        // Filtrando, la sección con coincidencias se fuerza expandida
        // (spec: "auto-expand a section on match"); sin filtro, respeta el
        // colapso manual (arranca expandida por default — spec: "Sections
        // start expanded").
        const expandida = filtroNormalizado ? true : !colapsadas.has(clave);
        // "Sin categoría" (id null) nunca tiene checkbox de grupo.
        const estado = grupo.id === null ? null : deriveEstadoCategoria(activosIds, servicioIds);
        const nombre = grupo.id === null ? t('sinCategoria') : grupo.nombre;

        return (
          <div key={clave} style={{ borderTop: index > 0 ? `1px solid ${colors.hairline}` : 'none' }}>
            <div
              onClick={() => toggleColapso(clave)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '12px 14px', cursor: 'pointer',
              }}
            >
              {estado !== null && (
                <span onClick={e => { e.stopPropagation(); handleToggleCategoria(activosIds, estado); }}>
                  <EstadoCheckbox estado={estado} />
                </span>
              )}
              <span style={{
                flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
                textTransform: 'uppercase', color: colors.subtext,
              }}>
                {nombre}
              </span>
              {expandida ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
            </div>
            {expandida && (
              <div style={{ padding: '0 8px 8px' }}>
                {visibles.map(renderFila)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
