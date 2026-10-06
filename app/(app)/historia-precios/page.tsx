'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';
import BackButton from '@/components/BackButton';
import PillToggle from '@/components/PillToggle';
import SelectorProfesional from '@/components/SelectorProfesional';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useHistoriaPrecios } from '@/hooks/useHistoriaPrecios';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { HistoriaPreciosCanvas, BASE_WIDTH, BASE_HEIGHT } from '@/components/historia-precios/HistoriaPreciosCanvas';
import { SelectorPlantilla } from '@/components/historia-precios/SelectorPlantilla';
import { GestorFotos } from '@/components/historia-precios/GestorFotos';
import { SeleccionServicios } from '@/components/historia-precios/SeleccionServicios';
import { ModoHistorias } from '@/components/historia-precios/ModoHistorias';
import { HistoriasFueraDePantalla } from '@/components/historia-precios/HistoriasFueraDePantalla';
import { avisoNoEntran, etiquetaAccion, leyendaPosicion } from '@/lib/historia/exportarHistorias';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';

// ─────────────────────────────────────────────
// Responsive preview wrapper — HistoriaPreciosCanvas ALWAYS renders at its
// intrinsic BASE_WIDTH/BASE_HEIGHT (design D3: no `scale`/`mode` prop, one
// code path for preview and export). On a narrow viewport that fixed size
// wouldn't fit on screen, so this wraps it in the same CSS `transform:
// scale()` trick MiniaturaCanvas uses for the picker thumbnails — the
// difference is this wrapper forwards `canvasRef` straight through to the
// INNER unscaled node (MiniaturaCanvas deliberately does not: "thumbnails
// are never the capture target"). The transform never touches the captured
// DOM, so this stays byte-identical to the export, same guarantee D3
// documents for the picker.
function useCanvasScale() {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(Math.min(BASE_WIDTH, window.innerWidth * 0.85));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const scale = width ? width / BASE_WIDTH : 1;
  return { width, height: BASE_HEIGHT * scale, scale };
}

export default function HistoriaPreciosPage() {
  const t      = useTranslations('historia.HistoriaPreciosPage');
  const tCard  = useTranslations('historia.TarjetaPrecios');

  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { servicios, fetchServicios }         = useServiciosStore();
  const { categorias, fetchCategorias }      = useCategoriasServicioStore();
  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
    if (servicios.length === 0) fetchServicios();
    fetchCategorias();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    effectiveProfesionalId, serviciosActivos, serviciosDisponibles,
    excluidosIds, setExcluidosIds,
    selectedProfesionalId, setSelectedProfesionalId,
    modo, setModo, historias, cantidadPorCategoria, idxHistoria, historiaActual, irAnterior, irSiguiente,
    nombreNegocio, telefono,
    templateId, handleTemplateChange,
    notaAdicional, setNotaAdicional, NOTA_MAX_LENGTH,
    notaActiva, setNotaActiva,
    notaAlineacion, setNotaAlineacion,
    fotos, fotosUrls, hayFotos, puedeCapturar,
    entra, nivelDensidad, onFitChange,
    hayVarias, reportarFit, registrarCanvas, entraTodas, historiasQueNoEntran, exportando,
    canvasRef, descargarImagen, compartirImagen,
  } = useHistoriaPrecios();

  // Fijo — servicios y promociones ahora conviven en una sola tarjeta
  // (TarjetaPrecios agrupa internamente por es_promo), ya no hay título por
  // modo.
  const titulo = tCard('header');
  // Lo que se renderiza en la tarjeta: vacío si el usuario desactivó la nota
  // (PillToggle más abajo), aunque el texto siga guardado — desactivar no
  // borra, así se puede reactivar sin volver a escribir.
  const notaParaMostrar = notaActiva ? notaAdicional : undefined;

  // Solo lo de la historia actual va a la tarjeta/preview/captura. En modo
  // categoría la tarjeta lleva el nombre de la categoría como subtítulo.
  const serviciosHistoria = historiaActual?.servicios ?? [];
  const subtituloHistoria = modo === 'categoria' ? historiaActual?.titulo ?? undefined : undefined;
  const hayNavegacion = hayVarias;
  const botonesInactivos = !puedeCapturar || exportando;
  const cantidadImagenes = hayVarias ? historias.length : 1;
  const avisoVarias = hayVarias && !entraTodas ? avisoNoEntran(historiasQueNoEntran, t) : null;
  const historiaActualNoEntra = historiaActual ? historiasQueNoEntran.some(h => h.id === historiaActual.id) : false;

  const { width: canvasWidth, height: canvasHeight, scale } = useCanvasScale();

  const cargando = profesionales.length === 0;
  const sinServicios = serviciosActivos.length === 0;

  // Multi-profesional — invisible con ≤1 profesional activa, mismo criterio
  // que app/(app)/agenda/historia/page.tsx. profesionalSeleccionada solo
  // existe con pick EXPLÍCITO (selectedProfesionalId, no el fallback a la
  // jefa) — mismo criterio que StoryCanvas.profesionalNombre: reemplaza el
  // nombre del negocio en el footer para que la historia lea como la
  // tarjeta de esa profesional puntual, no como la del negocio. El
  // CONTENIDO (servicios, fotos, etc.) sí usa effectiveProfesionalId, que
  // cae en la jefa por default (confirmado con el usuario, 2026-08-19):
  // arrancar mostrando los datos de la jefa, tildada en el picker, no
  // "nada" — distinto de agenda/nuevo, que nunca defaultea.
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const profesionalSeleccionada    = activeProfesionales.find(p => p.id === selectedProfesionalId) ?? null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 60 }}>
      {/* Header — 2 filas (BackButton, después título), mismo patrón que
          agenda/historia/page.tsx (26px, no inline con el botón). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 18px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      {cargando ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      ) : !effectiveProfesionalId ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('noProfessional')}</p>
        </div>
      ) : (
        <div style={{
          paddingTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: canvasWidth || '100%', margin: '0 auto',
        }}>
          {/* Selector de profesional — invisible con ≤1 profesional activa,
              mismo patrón que agenda/historia (ver useHistoriaPrecios:
              selectedProfesionalId/effectiveProfesionalId). Permite que cada
              profesional promocione sus propios precios/promos, no solo la
              jefa (que es el default con el que arranca, ver
              effectiveProfesionalId). */}
          {mostrarSelectorProfesional && (
            <SelectorProfesional
              label={t('showPricesOf')}
              // avatarUrl != avatar_url (ProfesionalOption vs Profesional) —
              // sin este mapeo, Profesional pasa el typecheck (prop
              // opcional) pero nunca muestra la foto real, solo iniciales.
              profesionales={activeProfesionales.map(p => ({ ...p, avatarUrl: p.avatar_url }))}
              selectedId={selectedProfesionalId ?? effectiveProfesionalId}
              onSelect={setSelectedProfesionalId}
            />
          )}

          {/* Preview + picker solo con al menos 1 foto subida — ninguna de
              las 8 plantillas actuales tiene minFotos:0 (a diferencia del
              catálogo anterior, que tenía un fallback sin foto). Sin esto,
              un usuario nuevo (0 fotos) vería el picker entero bloqueado y
              el preview de arriba con una imagen rota (`fotos[0]`
              undefined). Muestra el mismo mensaje que ya existía más abajo
              (`emptyPhotosState`), ahora también acá arriba. */}
          {!hayFotos ? (
            <p style={{ fontSize: 13, color: colors.subtext, textAlign: 'center', margin: '20px 0' }}>
              {t('emptyPhotosState')}
            </p>
          ) : (
            <>
              {/* Caption "Vista previa" a la izquierda — mismo alineado que
                  el título "Elegí tu diseño" de más abajo (templateSectionTitle),
                  no centrada. "Formato historia · 9:16" pasa al lado derecho
                  de la misma fila (antes iba debajo, apilada) ahora que ya
                  no comparte esa fila con el badge que se sacó. */}
              <div style={{ width: '100%', marginBottom: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{t('previewTitle')}</p>
                <p style={{ fontSize: 11, color: colors.subtext, margin: 0 }}>{t('previewFormat')}</p>
              </div>

              {/* Canvas preview — marco tipo celular alrededor del MISMO nodo
                  que captura la exportación (ver useCanvasScale arriba); el
                  frame es puramente decorativo, no toca el nodo con canvasRef. */}
              <div style={{ position: 'relative', padding: 6, borderRadius: 26, background: colors.strong, boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
                <div style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden', borderRadius: 20 }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <HistoriaPreciosCanvas
                      ref={canvasRef}
                      templateId={templateId}
                      fotos={fotosUrls}
                      titulo={titulo}
                      subtitulo={subtituloHistoria}
                      servicios={serviciosHistoria}
                      nombreNegocio={nombreNegocio}
                      telefono={telefono}
                      profesionalNombre={profesionalSeleccionada?.nombre}
                      nota={notaParaMostrar}
                      notaAlineacion={notaAlineacion}
                      onFitChange={onFitChange}
                    />
                  </div>
                </div>
                {hayNavegacion && (
                  <>
                    <FlechaHistoria lado="left" label={t('historiaAnterior')} onClick={irAnterior} />
                    <FlechaHistoria lado="right" label={t('historiaSiguiente')} onClick={irSiguiente} />
                  </>
                )}
              </div>
              {hayNavegacion && (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: historiaActualNoEntra ? colors.amberFg : colors.subtext, textAlign: 'center' }}>
                  {leyendaPosicion({ actual: idxHistoria + 1, total: historias.length, nombre: historiaActual?.titulo ?? '', noEntra: historiaActualNoEntra }, t)}
                </p>
              )}

              {/* Qué servicios entran en la historia — selección de sesión. */}
              {serviciosDisponibles.length > 0 && (
                <SeleccionServicios
                  servicios={serviciosDisponibles}
                  categorias={categorias}
                  excluidos={excluidosIds}
                  onChange={setExcluidosIds}
                  noEntra={modo === 'una' && !entra}
                />
              )}

              {/* Cómo repartir lo elegido: una historia o una por categoría. */}
              {serviciosDisponibles.length > 0 && (
                <ModoHistorias
                  modo={modo}
                  onChange={setModo}
                  cantidadServicios={serviciosActivos.length}
                  cantidadHistorias={cantidadPorCategoria}
                  entra={entra}
                />
              )}

              {/* Plantilla picker */}
              <div style={{ width: '100%', marginTop: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
                  {t('templateSectionTitle')}
                </p>
                <SelectorPlantilla
                  fotos={fotosUrls}
                  titulo={titulo}
                  servicios={serviciosHistoria}
                  subtitulo={subtituloHistoria}
                  nombreNegocio={nombreNegocio}
                  telefono={telefono}
                  profesionalNombre={profesionalSeleccionada?.nombre}
                  nota={notaParaMostrar}
                  notaAlineacion={notaAlineacion}
                  nivelDensidad={nivelDensidad}
                  templateId={templateId}
                  onTemplateChange={handleTemplateChange}
                />
              </div>

              {/* Texto adicional — aclaración libre y corta (seña, retiro
                  aparte, etc.) que se renderiza al pie de la tarjeta. Mismo
                  patrón visual que la sección "Fotos" de más abajo (tarjeta
                  con borde), agregado a pedido del mock v0 actualizado
                  (price-story.tsx, `footerNote`). El PillToggle apaga/prende
                  SIN borrar el texto (ver notaActiva en useHistoriaPrecios)
                  — reactivar no obliga a tipearlo de nuevo. Persiste por
                  profesional en el backend (Profesional.historia_precios_nota,
                  autosave debounced — ver useHistoriaPrecios), a pedido
                  explícito del usuario: una versión anterior usaba
                  localStorage y se perdía al cambiar de dispositivo. */}
              <div style={{
                width: '100%', marginTop: 20, padding: '14px', borderRadius: 14,
                border: `1px solid ${colors.border}`, background: colors.surface,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.textStrong }}>
                      {t('notaAdicionalTitle')}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: colors.subtext }}>
                      {t('notaAdicionalHint')}
                    </p>
                  </div>
                  <PillToggle value={notaActiva} onChange={setNotaActiva} />
                </div>
                <div style={{ marginTop: 10, opacity: notaActiva ? 1 : 0.5 }}>
                <textarea
                  value={notaAdicional}
                  onChange={e => setNotaAdicional(e.target.value)}
                  maxLength={NOTA_MAX_LENGTH}
                  rows={3}
                  placeholder={t('notaAdicionalPlaceholder')}
                  style={{
                    width: '100%', resize: 'none', boxSizing: 'border-box',
                    padding: '10px 12px', borderRadius: 12, border: `1px solid ${colors.border}`,
                    background: colors.surfaceSubtle, color: colors.textStrong,
                    fontSize: 12, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 8, background: colors.surfaceSubtle }}>
                    <span style={{ padding: '0 4px', fontSize: 9, color: colors.subtext }}>{t('notaAdicionalAlignLabel')}</span>
                    {([
                      ['left', AlignLeft, t('notaAdicionalAlignLeft')],
                      ['center', AlignCenter, t('notaAdicionalAlignCenter')],
                      ['right', AlignRight, t('notaAdicionalAlignRight')],
                      ['justify', AlignJustify, t('notaAdicionalAlignJustify')],
                    ] as const).map(([value, Icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={label}
                        title={label}
                        onClick={() => setNotaAlineacion(value)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: notaAlineacion === value ? colors.surface : 'transparent',
                          boxShadow: notaAlineacion === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                          color: notaAlineacion === value ? colors.textStrong : colors.subtext,
                        }}
                      >
                        <Icon size={13} />
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: colors.subtext }}>
                    {notaAdicional.length}/{NOTA_MAX_LENGTH}
                  </span>
                </div>
                </div>
              </div>
            </>
          )}

          {/* Gestor de fotos — header con chip de ícono + título/hint dentro
              de una tarjeta con borde, imitando el estilo de la sección
              "Fotos de fondo" del mock v0 (icon chip + card, ver
              price-story.tsx) — GestorFotos ya tiene su propio tile de "+"
              para subir, no se duplica ese control acá. */}
          <div style={{
            width: '100%', marginTop: 25, paddingTop: 20,
            borderTop: `1px solid ${colors.divider}`,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
              padding: '12px 14px', borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.surface,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: withAlpha(colors.primary, '20'), display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ImagePlus size={18} color={colors.primaryDeep} strokeWidth={2} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textStrong }}>
                  {t('photosSectionTitle')}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
                  {t('photosSectionHint')}
                </p>
              </div>
            </div>
            <GestorFotos profesionalId={effectiveProfesionalId} fotos={fotos} />
          </div>

          {!hayFotos && (
            <p style={{ fontSize: 12, color: colors.subtext, textAlign: 'center', margin: '16px 0 0' }}>
              {t('emptyPhotosState')}
            </p>
          )}
          {hayFotos && !puedeCapturar && (
            <p style={{
              fontSize: 12, textAlign: 'center', margin: '16px 0 0',
              color: avisoVarias || (!sinServicios && !entra) ? colors.amberFg : colors.subtext,
            }}>
              {avisoVarias ?? (sinServicios || entra ? t('seleccionVacia') : modo === 'categoria' ? t('historiaNoEntra') : t('seleccionNoEntra'))}
            </p>
          )}

          {/* Footer actions */}
          <div style={{ width: '100%', marginTop: 25, display: 'flex', gap: 10 }}>
            <button
              onClick={descargarImagen}
              disabled={botonesInactivos}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 0', borderRadius: 14, background: colors.surface, border: `1.5px solid ${colors.border}`,
                cursor: botonesInactivos ? 'not-allowed' : 'pointer', opacity: botonesInactivos ? 0.5 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: colors.primaryDeep }}>{etiquetaAccion('guardar', cantidadImagenes, t)}</span>
            </button>
            <button
              onClick={compartirImagen}
              disabled={botonesInactivos}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 0', borderRadius: 14, background: colors.surface, border: `1.5px solid ${colors.border}`,
                cursor: botonesInactivos ? 'not-allowed' : 'pointer', opacity: botonesInactivos ? 0.5 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: colors.primaryDeep }}>{etiquetaAccion('compartir', cantidadImagenes, t)}</span>
            </button>
          </div>
          {/* Una por categoría: todas las historias montadas fuera de pantalla
              para medir su ajuste y capturarlas al exportar. */}
          {hayVarias && hayFotos && (
            <HistoriasFueraDePantalla
              historias={historias}
              registrarCanvas={registrarCanvas}
              reportarFit={reportarFit}
              templateId={templateId}
              fotos={fotosUrls}
              titulo={titulo}
              nombreNegocio={nombreNegocio}
              telefono={telefono}
              profesionalNombre={profesionalSeleccionada?.nombre}
              nota={notaParaMostrar}
              notaAlineacion={notaAlineacion}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Flecha de navegación sobre el costado del preview (44px de área táctil).
function FlechaHistoria({ lado, label, onClick }: { lado: 'left' | 'right'; label: string; onClick: () => void }) {
  const Icono = lado === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        position: 'absolute', top: '50%', [lado]: 14, transform: 'translateY(-50%)',
        width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
        background: withAlpha(colors.surface, 'E6'), color: colors.primaryDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icono size={20} strokeWidth={2.5} />
    </button>
  );
}
