'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronUp, Minus, Search, X } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import type { Servicio } from '@/services/servicioService';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';
import { deriveEstadoCategoria, type EstadoCategoria } from '@/lib/deriveEstadoCategoria';

// Picker de servicios compartido — reemplaza tres implementaciones que
// habían divergido de forma independiente: `configuracion/SelectorServiciosPorCategoria`
// (multi, agrupado por categoría real), `agenda/ServicioPicker` (multi, solo
// split Servicios/Promociones) y el acordeón calcado a mano en el sheet de
// filtros de agenda (single, mismo split binario). Unificado y validado vía
// mockup antes de implementar (ver PR).
interface Props {
  servicios:   Servicio[];
  mode:        'multi' | 'single';
  // Set COMPLETO de ids seleccionados. En `mode: 'single'` nunca tiene más
  // de un elemento — el componente lo garantiza internamente.
  selectedIds: number[];
  // Recibe siempre el set COMPLETO nuevo, nunca un delta — tanto un tick
  // individual como un bulk-toggle de categoría son mutaciones en bloque.
  onChange:    (nextIds: number[]) => void;
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

// Indicador radio-style de `mode: 'single'` — deliberadamente distinto del
// checkbox de `mode: 'multi'` (spec del mockup: un usuario debe poder
// distinguir "elegí uno" de "elegí varios" de un vistazo).
function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: 20, height: 20, borderRadius: 10,
      border: `2px solid ${selected ? colors.primarySolid : colors.divider}`,
      backgroundColor: colors.surface,
    }}>
      {selected && (
        <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primarySolid }} />
      )}
    </span>
  );
}

export function SelectorServicios({ servicios, mode, selectedIds, onChange }: Props) {
  const t = useTranslations('common.SelectorServicios');

  // Mismo patrón que configuracion/servicios/page.tsx: `categoriasReady`
  // distingue "todavía no cargó" de "cargó y no hay categorías" (evita el
  // flash de "Sin categoría" en el primer render).
  const { categorias, fetchCategorias } = useCategoriasServicioStore();
  const [categoriasReady, setCategoriasReady] = useState(false);
  useEffect(() => { fetchCategorias().finally(() => setCategoriasReady(true)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filtro, setFiltro] = useState('');
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  // Regla única, sin excepción por `mode`: los servicios inactivos nunca se
  // renderizan, nunca entran en `agruparServiciosPorCategoria` y por lo
  // tanto nunca participan del cálculo tri-estado, de las mutaciones de
  // categoría, ni de los chips/pill de seleccionados — aunque estén
  // presentes en `selectedIds` (ya asignados antes de desactivarse), quedan
  // invisibles e intocables acá (ver `handleToggleCategoria`).
  const serviciosActivos = useMemo(() => servicios.filter(s => s.activo), [servicios]);
  const grupos = useMemo(
    () => agruparServiciosPorCategoria(serviciosActivos, categorias),
    [serviciosActivos, categorias]
  );
  // Zero-Category Fallback: si ninguna cuenta categorizó servicios todavía,
  // se renderiza como lista plana sin headers — mismo criterio que
  // configuracion/servicios/page.tsx, en ambos modos.
  const hayServicioCategorizado = serviciosActivos.some(s => s.categoria_id !== null);

  // Buscador solo en `mode: 'multi'` (mockup no lo incluyó en single — la
  // pantalla que usa single ya tiene su propia búsqueda por otros campos).
  const filtroNormalizado = mode === 'multi' ? filtro.trim().toLowerCase() : '';
  const coincide = (s: Servicio) => s.nombre.toLowerCase().includes(filtroNormalizado);
  const claveGrupo = (id: number | null) => (id === null ? 'sin-categoria' : String(id));

  const handleSelectServicio = (id: number) => {
    if (mode === 'single') {
      // Radio semantics: tocar el ya seleccionado lo limpia; tocar otro
      // reemplaza cualquier selección previa.
      onChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  // CRÍTICO (spec original: "Inactive Assigned Services Are Never Touched
  // by Category Actions" + "Category State and Actions Ignore the Text
  // Filter"): `activosIds` viene SIEMPRE de `grupo.servicios` — ya filtrado
  // a solo activos, y NUNCA recortado por `filtroNormalizado`. Solo aplica
  // en `mode: 'multi'` — el bulk-toggle de categoría no tiene sentido en
  // una selección única.
  const handleToggleCategoria = (activosIds: number[], estado: EstadoCategoria) => {
    if (estado === 'checked') {
      onChange(selectedIds.filter(id => !activosIds.includes(id)));
    } else {
      const seleccionados = new Set(selectedIds);
      const agregados = activosIds.filter(id => !seleccionados.has(id));
      onChange([...selectedIds, ...agregados]);
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

  const serviciosSeleccionados = serviciosActivos.filter(s => selectedIds.includes(s.id));

  const renderFila = (s: Servicio) => (
    <button
      key={s.id}
      onClick={() => handleSelectServicio(s.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        background: 'none', border: 'none',
      }}
    >
      {mode === 'multi'
        ? <ServicioCheckbox checked={selectedIds.includes(s.id)} />
        : <RadioIndicator selected={selectedIds.includes(s.id)} />}
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: colors.text,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{s.nombre}</span>
      <span style={{ fontSize: 12, color: colors.subtext, flexShrink: 0 }}>{s.duracion_minutos} min</span>
    </button>
  );

  // Fila "Todos" — solo en `mode: 'single'`, siempre primera, limpia la
  // selección (mirror del patrón `filterAll` ya usado en GastosPage /
  // IngresosPage / HistorialClienteSheetHost para "ningún filtro
  // aplicado", con concordancia de género para "servicios").
  const filaTodos = mode === 'single' && (
    <button
      onClick={() => onChange([])}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        background: 'none', border: 'none',
      }}
    >
      <RadioIndicator selected={selectedIds.length === 0} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>
        {t('filterAll')}
      </span>
    </button>
  );

  const pillSeleccionados = mode === 'multi' && serviciosSeleccionados.length > 0 && (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <span style={{
        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        backgroundColor: colors.primarySoft, color: colors.primaryDeep,
      }}>
        {t('selectedCount', { count: serviciosSeleccionados.length })}
      </span>
    </div>
  );

  const buscador = mode === 'multi' && (
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

  const chipsSeleccionados = mode === 'multi' && serviciosSeleccionados.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, borderBottom: `1px solid ${colors.hairline}` }}>
      {serviciosSeleccionados.map(s => (
        <button
          key={s.id}
          onClick={() => handleSelectServicio(s.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 10px',
            fontSize: 12, fontWeight: 600, color: colors.primaryDeep, backgroundColor: colors.primarySoft,
            border: 'none', cursor: 'pointer',
          }}
        >
          {s.nombre}
          <X size={12} strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );

  if (!hayServicioCategorizado) {
    // Fallback plano: sin categorías reales en uso todavía, ni headers ni
    // "Sin categoría" — vista idéntica a un checklist simple (más la fila
    // "Todos" al principio en `mode: 'single'`).
    const visibles = filtroNormalizado ? serviciosActivos.filter(coincide) : serviciosActivos;
    return (
      <div>
        {pillSeleccionados}
        <div style={{
          borderRadius: 16, border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface, boxShadow: shadows.card, overflow: 'hidden',
        }}>
          {buscador}
          {chipsSeleccionados}
          <div style={{ padding: '4px 8px 8px' }}>
            {filaTodos}
            {visibles.length === 0 ? (
              <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: colors.subtext, margin: 0 }}>
                {t('noResults')}
              </p>
            ) : visibles.map(renderFila)}
          </div>
        </div>
      </div>
    );
  }

  // El checkbox y las acciones de categoría siempre operan sobre
  // `grupo.servicios` (activos, sin filtrar por texto) — `visibles` solo
  // decide qué filas se muestran, nunca qué ids toca la categoría.
  const secciones = grupos
    .map(grupo => {
      const activosIds = grupo.servicios.map(s => s.id);
      const visibles = filtroNormalizado ? grupo.servicios.filter(coincide) : grupo.servicios;
      return { grupo, activosIds, visibles };
    })
    .filter(({ visibles }) => !filtroNormalizado || visibles.length > 0);

  return (
    <div>
      {pillSeleccionados}
      <div style={{
        borderRadius: 16, border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface, boxShadow: shadows.card, overflow: 'hidden',
      }}>
        {buscador}
        {chipsSeleccionados}
        {mode === 'single' && (
          <div style={{ padding: '4px 8px 0' }}>
            {filaTodos}
          </div>
        )}
        {secciones.length === 0 ? (
          <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: colors.subtext, margin: 0 }}>
            {t('noResults')}
          </p>
        ) : secciones.map(({ grupo, activosIds, visibles }, index) => {
          const clave = claveGrupo(grupo.id);
          // Filtrando, la sección con coincidencias se fuerza expandida;
          // sin filtro, respeta el colapso manual (arranca expandida por
          // default). Independiente por sección en ambos modos.
          const expandida = filtroNormalizado ? true : !colapsadas.has(clave);
          // "Sin categoría" (id null) nunca tiene checkbox de grupo; en
          // `mode: 'single'` ninguna categoría lo tiene (no hay bulk-toggle
          // en selección única).
          const estado = (mode === 'multi' && grupo.id !== null)
            ? deriveEstadoCategoria(activosIds, selectedIds)
            : null;
          const nombre = grupo.id === null ? t('sinCategoria') : grupo.nombre;

          return (
            <div key={clave} style={{ borderTop: index > 0 || mode === 'single' ? `1px solid ${colors.hairline}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                {estado !== null && (
                  <button
                    onClick={() => handleToggleCategoria(activosIds, estado)}
                    aria-label={estado === 'checked' ? t('deselectCategory') : t('selectCategory')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                  >
                    <EstadoCheckbox estado={estado} />
                  </button>
                )}
                <button
                  onClick={() => toggleColapso(clave)}
                  aria-expanded={expandida}
                  aria-label={expandida ? t('collapseCategory') : t('expandCategory')}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                  }}
                >
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
                    textTransform: 'uppercase', color: colors.subtext,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {nombre}
                  </span>
                  {expandida ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
                </button>
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
    </div>
  );
}
