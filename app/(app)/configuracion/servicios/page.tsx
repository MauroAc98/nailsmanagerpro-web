'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useServiciosStore, useServiciosFiltrados } from '@/store/useServicioStore';
import { Servicio } from '@/services/servicioService';
import { NAV_CLEARANCE } from '@/constants/layout';
import ServicioCard from '@/components/ServicioCard';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { profesionalJefa } from '@/services/profesionalService';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { CategoriaServicio } from '@/services/categoriaServicioService';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';

// ReorderableSection — un grupo (regular o promo) con su propio DndContext
// / SortableContext, así arrastrar nunca mezcla ids entre grupos: cada
// drag-end llama a `onReorder` con el array COMPLETO del grupo afectado
// (contrato de reordenarServicios / PATCH /servicios/reordenar). Reusa el
// mensaje de `emptyState` existente cuando el grupo específico queda vacío
// (ej. cuenta sin promociones cargadas todavía).
// Nunca se renderiza con `servicios` vacío — el padre (ver más abajo) salta
// directamente la sección entera cuando el grupo no tiene items, en vez de
// mostrar un header "PROMOCIONES" seguido de un placeholder "sin
// promociones": la mayoría de los negocios no carga promociones, así que ese
// placeholder era peso muerto visible siempre, no un estado excepcional.
function ReorderableSection({
  title, servicios, onEdit, onToggle, onDelete, onReorder,
}: {
  title?:     string;
  servicios:  Servicio[];
  onEdit:     (id: number) => void;
  onToggle:   (servicio: Servicio, activo: boolean) => void;
  onDelete:   (servicio: Servicio) => void;
  onReorder:  (ids: number[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = servicios.map(s => s.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div>
      {title && (
        <h2 style={{
          margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: colors.subtext,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {title}
        </h2>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={servicios.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servicios.map(s => (
              <ServicioCard
                key={s.id}
                servicio={s}
                draggable
                onEdit={() => onEdit(s.id)}
                onToggle={activo => onToggle(s, activo)}
                onDelete={() => onDelete(s)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface GrupoCategoria {
  // null = "Sin categoria" — siempre al final (ver `agruparPorCategoria`),
  // nunca aparece si no hay servicios sin categorizar.
  id:         number | null;
  nombre:     string;
  regulares:  Servicio[];
  promos:     Servicio[];
}

// Sub-partición por es_promo (mismo criterio que el flat regular/promo de
// siempre) sobre el agrupamiento compartido `agruparServiciosPorCategoria`
// (orden/skip-empty/"Sin categoria"-al-final ahora vive ahí, reusado también
// por el picker de servicios de profesionales — ver lib/agruparServiciosPorCategoria.ts).
function agruparPorCategoria(servicios: Servicio[], categorias: CategoriaServicio[]): GrupoCategoria[] {
  return agruparServiciosPorCategoria(servicios, categorias).map(grupo => ({
    id: grupo.id,
    nombre: grupo.nombre,
    regulares: grupo.servicios.filter(s => !s.es_promo),
    promos: grupo.servicios.filter(s => s.es_promo),
  }));
}

export default function ServiciosPage() {
  const t = useTranslations('configuracion.ServiciosPage');
  const router = useRouter();
  const { loading, error, buscar, fetchServicios, toggleServicio, reordenarServicios, setBuscar, eliminarServicio } = useServiciosStore();
  const serviciosFiltrados = useServiciosFiltrados();

  useEffect(() => { fetchServicios(); }, []);

  // `categoriasReady` distingue "todavía no cargó" de "cargó y no hay
  // categorías" (`categorias: []` es el estado inicial del store ANTES del
  // fetch, no equivale a "el usuario no tiene categorías"). Sin este flag,
  // el primer render mostraría todos los servicios bajo "Sin categoria" por
  // un instante — el flash que el spec prohíbe explícitamente. `finally`
  // cubre éxito y error por igual: fetchCategorias ya atrapa sus propios
  // errores (ver useCategoriasServicioStore), así que acá solo importa que
  // la promesa haya asentado.
  const { categorias, fetchCategorias } = useCategoriasServicioStore();
  const [categoriasReady, setCategoriasReady] = useState(false);
  useEffect(() => { fetchCategorias().finally(() => setCategoriasReady(true)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Eliminar — el backend bloquea el borrado (409) si el servicio tiene
  // turnos asociados; `result.message` ya trae ese texto explicando por qué
  // (extraerMensajeError lee el campo `message` del body de Laravel), así
  // que alertDialog lo muestra directo sin plomería extra acá.
  const handleEliminar = async (servicio: Servicio) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm', { nombre: servicio.nombre }),
      { confirmText: t('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    const result = await eliminarServicio(servicio.id);
    if (result.success) showToast(t('deleted'));
    else await alertDialog(result.message ?? t('deleteError'));
  };

  const handleToggle = async (servicio: Servicio, activo: boolean) => {
    if (!activo) {
      const confirmado = await confirmDialog(
        t('deactivateConfirm', { nombre: servicio.nombre }),
        { confirmText: t('deactivateConfirmButton'), danger: true }
      );
      if (!confirmado) return;
    }
    await toggleServicio(servicio.id, activo);
  };

  // Split en 2 grupos independientemente reordenables (regular vs. promo —
  // ver reordenarServicios). Solo se usa cuando `!buscar`: buscando, la
  // lista plana filtrada de useServiciosFiltrados no tiene un agrupamiento
  // estable que tenga sentido para drag-and-drop (ver render abajo).
  const serviciosRegulares = serviciosFiltrados.filter(s => !s.es_promo);
  const serviciosPromo = serviciosFiltrados.filter(s => s.es_promo);

  // Anti-regresión (spec: "zero services categorized"): si ninguna cuenta
  // usó categorías todavía, la vista queda IDÉNTICA a la de siempre —
  // regular/promo plano, sin headers de categoría. El cambio es invisible
  // hasta que el usuario efectivamente categoriza algo.
  const hayServicioCategorizado = serviciosFiltrados.some(s => s.categoria_id !== null);
  const gruposPorCategoria = useMemo(
    () => agruparPorCategoria(serviciosFiltrados, categorias),
    [serviciosFiltrados, categorias]
  );

  // Entry point a "historia de precios" (spec: price-story) — gateado en que
  // el campo NUEVO exista en la respuesta del backend (no en que tenga un
  // valor truthy: `historia_precios_template_id` es válidamente `null` cuando
  // la profesional todavía no eligió plantilla). Mientras el backend no
  // mande el campo, `historia_precios_template_id` viene `undefined` en el
  // objeto real (aunque el tipo lo declare como `TemplateId | null`), así que
  // el botón queda invisible hasta que el backend despliegue el feature —
  // ver design.md, "Migration / Rollout".
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  useEffect(() => { if (profesionales.length === 0) fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const jefa = profesionalJefa(profesionales);
  const mostrarHistoriaPreciosButton = jefa !== null && jefa.historia_precios_template_id !== undefined;

  return (
    // AgendaThemeScope vive en app/(app)/configuracion/servicios/layout.tsx
    // (segmento completo migrado — listado + nuevo + [id]), no acá.
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Entry point: historia de precios (spec: price-story) */}
      {mostrarHistoriaPreciosButton && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            onClick={() => router.push('/historia-precios')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              backgroundColor: withAlpha(colors.primary, '15'),
              border: `1px solid ${withAlpha(colors.primary, '33')}`,
              boxShadow: shadows.card, borderRadius: 14,
              padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, backgroundColor: withAlpha(colors.primary, '25'),
              borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>
                {t('priceStoryButton')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
                {t('priceStoryButtonHint')}
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/servicios/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Search */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {serviciosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {buscar ? t('noResults') : t('emptyState')}
            </p>
          ) : buscar ? (
            // Buscando: lista plana sin agrupar ni drag-and-drop — reordenar
            // no tiene sentido sobre un recorte de búsqueda.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {serviciosFiltrados.map(s => (
                <ServicioCard
                  key={s.id}
                  servicio={s}
                  onEdit={() => router.push(`/configuracion/servicios/${s.id}`)}
                  onToggle={activo => handleToggle(s, activo)}
                  onDelete={() => handleEliminar(s)}
                />
              ))}
            </div>
          ) : !hayServicioCategorizado ? (
            // Anti-regresión: ningún servicio tiene categoria_id todavía —
            // vista idéntica a la de siempre, sin headers de categoría.
            <>
              {serviciosRegulares.length > 0 && (
                <ReorderableSection
                  title={t('sectionServicios')}
                  servicios={serviciosRegulares}
                  onEdit={id => router.push(`/configuracion/servicios/${id}`)}
                  onToggle={handleToggle}
                  onDelete={handleEliminar}
                  onReorder={reordenarServicios}
                />
              )}
              {serviciosPromo.length > 0 && (
                <ReorderableSection
                  title={t('sectionPromociones')}
                  servicios={serviciosPromo}
                  onEdit={id => router.push(`/configuracion/servicios/${id}`)}
                  onToggle={handleToggle}
                  onDelete={handleEliminar}
                  onReorder={reordenarServicios}
                />
              )}
            </>
          ) : !categoriasReady ? (
            // Categorías todavía no asentaron (ver efecto de fetchCategorias
            // arriba) — evita el flash de todo bajo "Sin categoria".
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
            </div>
          ) : (
            gruposPorCategoria.map(grupo => (
              <div key={grupo.id ?? 'sin-categoria'} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{
                  margin: 0, fontSize: 13, fontWeight: 700, color: colors.subtext,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {grupo.id === null ? t('sectionSinCategoria') : grupo.nombre}
                </h2>
                {grupo.regulares.length > 0 && grupo.promos.length > 0 ? (
                  <>
                    <ReorderableSection
                      title={t('sectionServicios')}
                      servicios={grupo.regulares}
                      onEdit={id => router.push(`/configuracion/servicios/${id}`)}
                      onToggle={handleToggle}
                      onDelete={handleEliminar}
                      onReorder={reordenarServicios}
                    />
                    <ReorderableSection
                      title={t('sectionPromociones')}
                      servicios={grupo.promos}
                      onEdit={id => router.push(`/configuracion/servicios/${id}`)}
                      onToggle={handleToggle}
                      onDelete={handleEliminar}
                      onReorder={reordenarServicios}
                    />
                  </>
                ) : (
                  <ReorderableSection
                    servicios={grupo.regulares.length > 0 ? grupo.regulares : grupo.promos}
                    onEdit={id => router.push(`/configuracion/servicios/${id}`)}
                    onToggle={handleToggle}
                    onDelete={handleEliminar}
                    onReorder={reordenarServicios}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
