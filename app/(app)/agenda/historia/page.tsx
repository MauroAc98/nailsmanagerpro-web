'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft, ChevronRight, ImagePlus, Download, Share2, ImageOff,
  CalendarDays, Type, Eye,
} from 'lucide-react';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useGenerarHistoria, Modo } from '@/hooks/useGenerarHistoria';
import { StoryCanvas } from '@/components/historia/StoryCanvas';
import { TextoLibreInput } from '@/components/historia/TextoLibreInput';
import { AgendaEditor } from '@/components/historia/AgendaEditor';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { confirmDialog } from '@/store/useConfirmStore';

type SeccionEditor = 'agenda' | 'texto' | 'fondo';

// ─────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────
const tabContainerStyle: React.CSSProperties = {
  display: 'flex', background: colors.surfaceSubtle, borderRadius: 20, padding: 3, marginBottom: 14,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, textAlign: 'center', padding: '8px 18px', borderRadius: 17, border: 'none',
    cursor: 'pointer',
    background:  active ? colors.primary : 'transparent',
    color:       active ? colors.primaryFg : colors.subtext,
    fontWeight:  700, fontSize: 11, letterSpacing: active ? 0 : 0.5,
    boxShadow:   active ? `0 2px 6px ${withAlpha(colors.primary, '59')}` : 'none',
  };
}

const sectionTabContainerStyle: React.CSSProperties = {
  display: 'flex', background: colors.surfaceSubtle, borderRadius: 20, padding: 3, marginBottom: 16, width: '100%',
};

function sectionTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 17, border: 'none', cursor: 'pointer',
    background: active ? colors.primary : 'transparent',
    color:      active ? colors.primaryFg : colors.subtext,
    fontWeight: 700, fontSize: 12,
    boxShadow:  active ? `0 2px 6px ${withAlpha(colors.primary, '59')}` : 'none',
  };
}

const navButtonStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
  background: colors.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const footerActionStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '13px 0', borderRadius: 16, background: colors.surface, border: `1px solid ${colors.border}`, cursor: 'pointer',
};

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function HistoriaContent() {
  const t            = useTranslations('historia.HistoriaPage');
  const router       = useRouter();
  const searchParams = useSearchParams();
  const fechaInicial = searchParams.get('fecha') ?? undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [seccion, setSeccion] = useState<SeccionEditor>('agenda');
  const [mostrarAyuda, setMostrarAyuda] = useState(false);

  const {
    modo, quincena, diasOcultos, slotsOcultos,
    agendaGenerada, diasQuincena, diasAMostrar, hayContenido, titulo, tituloNav,
    textosCanvas, textoInput, setTextoInput, mostrarEmojis, setMostrarEmojis, editandoId,
    canvasRef, canvasWidth, canvasHeight,
    selectedProfesionalId, setSelectedProfesionalId, effectiveProfesionalId,
    handleModo, handleNavegar, setQuincena, setDiasOcultos, setSlotsOcultos,
    toggleDiaOculto, toggleSlot, toggleHoraEnTodos,
    agregarTexto, iniciarEdicion, cancelarEdicion,
    actualizarPosicion, eliminarTexto, cambiarFontSize, redimensionarTexto,
    elegirFoto, quitarFondoFijo, descargarImagen, compartirImagen, fondoUri, fondoFijoGuardado,
    nombreEstudio, telefonoEstudio,
  } = useGenerarHistoria(fechaInicial);

  // Multi-agenda — invisible con ≤1 profesional activa, mismo criterio que
  // el resto de la app.
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const profesionalSeleccionada    = activeProfesionales.find(p => p.id === selectedProfesionalId) ?? null;

  // Cantidad de horarios que efectivamente van a la imagen — mismo dato que
  // ya excluye días/slots ocultados manualmente (diasAMostrar), solo para el
  // resumen arriba del canvas.
  const horariosVisibles = diasAMostrar.reduce((acc, dia) => acc + dia.slots.filter(s => s.libre).length, 0);
  const periodoLabel = modo === 'dia' ? t('tabDay') : modo === 'semana' ? t('tabWeek') : t('tabMonth');
  const nombreParaResumen = profesionalSeleccionada?.nombre || nombreEstudio;

  // Tocar un texto libre directo en el canvas es posible desde cualquier
  // tab (el canvas se ve siempre) pero el editor de texto solo está montado
  // en el tab "Texto" — sin este wrapper, tocar un texto estando en
  // "Agenda" o "Fondo" entraba en modo edición sin que se viera nada.
  const iniciarEdicionDesdeCanvas = (id: string) => {
    iniciarEdicion(id);
    setSeccion('texto');
  };

  const handleFondoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const guardarFijo = await confirmDialog(
      t('saveBackgroundPrompt'),
      { confirmText: t('saveFixed'), cancelText: t('useOnce') }
    );
    elegirFoto(file, guardarFijo);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, display: 'flex', color: colors.text }}
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      {/* width = canvasWidth, ver comentario original: todo lo que use
          width:'100%' abajo queda tan ancho como la imagen. */}
      <div style={{
        paddingTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: canvasWidth || '100%', margin: '0 auto',
      }}>

        {/* Mode tabs — siempre visibles: es la única forma de salir de un
            período sin contenido (p. ej. "Día" de hoy vacío) y volver a
            elegir otro. Nunca deben quedar atrapados detrás del estado
            vacío de más abajo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12 }}>
          <CalendarDays size={16} color={colors.primary} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.subtext }}>
            {t('whatToShow')}
          </span>
          <div style={{ ...tabContainerStyle, marginBottom: 0, marginLeft: 'auto' }}>
            {(['dia', 'semana', 'mes'] as Modo[]).map(m => (
              <button key={m} onClick={() => handleModo(m)} style={{ ...tabStyle(modo === m), padding: '6px 12px' }}>
                {m === 'dia' ? t('tabDay') : m === 'semana' ? t('tabWeek') : t('tabMonth')}
              </button>
            ))}
          </div>
        </div>

        {/* Quincena tabs */}
        {modo === 'mes' && (
          <div style={{ ...tabContainerStyle, width: '100%' }}>
            {[0, 1].map(i => (
              <button
                key={i}
                onClick={() => { setQuincena(i as 0 | 1); setDiasOcultos([]); setSlotsOcultos([]); }}
                style={tabStyle(quincena === i)}
              >
                {i === 0 ? t('firstHalf') : t('secondHalf')}
              </button>
            ))}
          </div>
        )}

        {/* Selector de profesional — invisible con ≤1 profesional activa */}
        {mostrarSelectorProfesional && (
          <div style={{ width: '100%', marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('showScheduleOf')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeProfesionales.map(p => {
                const selected = (selectedProfesionalId ?? effectiveProfesionalId) === p.id;
                const color    = p.color || colors.primary;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfesionalId(selected ? null : p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${selected ? color : colors.border}`,
                      backgroundColor: selected ? color : colors.surface,
                      color: selected ? colors.primaryFg : colors.text,
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      backgroundColor: selected ? colors.primaryFg : color,
                    }} />
                    {p.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Date nav */}
        <div style={{
          display: 'flex', alignItems: 'center', width: '100%', gap: 8, marginBottom: 16,
          borderRadius: 18, border: `1px solid ${colors.border}`, backgroundColor: colors.surfaceSubtle, padding: '10px 14px',
        }}>
          <button onClick={() => handleNavegar(-1)} style={navButtonStyle}>
            <ChevronLeft size={18} strokeWidth={2} color={colors.primaryDeep} />
          </button>
          <span style={{
            flex: 1, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 16,
            textAlign: 'center', color: colors.textStrong,
          }}>
            {tituloNav}
          </span>
          <button onClick={() => handleNavegar(1)} style={navButtonStyle}>
            <ChevronRight size={18} strokeWidth={2} color={colors.primaryDeep} />
          </button>
        </div>

        {hayContenido ? (
          <>
            {/* Resumen + vista previa */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{t('readyToEdit')}</p>
                <p style={{ fontSize: 11, color: colors.subtext, margin: '2px 0 0' }}>
                  {periodoLabel} · {nombreParaResumen} · {t('visibleSlotsCount', { count: horariosVisibles })}
                </p>
              </div>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                borderRadius: 20, padding: '5px 10px', fontSize: 10, fontWeight: 700,
                backgroundColor: colors.successBg, color: colors.success,
              }}>
                <Eye size={12} strokeWidth={2.5} />
                {t('previewBadge')}
              </span>
            </div>

            <StoryCanvas
              ref={canvasRef}
              titulo={titulo}
              nombreEstudio={nombreEstudio}
              telefonoEstudio={telefonoEstudio}
              profesionalNombre={profesionalSeleccionada?.nombre}
              dias={diasAMostrar}
              fondoUri={fondoUri}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              textosLibres={textosCanvas}
              onMoverTexto={actualizarPosicion}
              onResizeTexto={redimensionarTexto}
              onEditarTexto={iniciarEdicionDesdeCanvas}
            />

            {/* Editor: Agenda / Texto / Fondo */}
            <div style={{
              width: '100%', marginTop: 20, paddingTop: 18, borderTop: `1px solid ${colors.hairline}`,
            }}>
              <div style={sectionTabContainerStyle}>
                {(['agenda', 'texto', 'fondo'] as SeccionEditor[]).map(s => (
                  <button key={s} onClick={() => setSeccion(s)} style={sectionTabStyle(seccion === s)}>
                    {s === 'agenda' ? t('sectionAgenda') : s === 'texto' ? t('sectionText') : t('sectionBackground')}
                  </button>
                ))}
              </div>

              {seccion === 'agenda' && (
                <div>
                  {agendaGenerada.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <p style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 17, color: colors.textStrong, margin: 0 }}>
                          {t('editAvailability')}
                        </p>
                        <button
                          onClick={() => setMostrarAyuda(v => !v)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: colors.primaryDeep, padding: 0 }}
                        >
                          {mostrarAyuda ? t('hideHelp') : t('howItWorks')}
                        </button>
                      </div>
                      {mostrarAyuda && (
                        <p style={{
                          fontSize: 11, lineHeight: 1.5, color: colors.amberFg, backgroundColor: colors.amberBg,
                          borderRadius: 12, padding: '8px 12px', margin: '6px 0 10px',
                        }}>
                          {t('editAvailabilityHint')}
                        </p>
                      )}
                      <div style={{ marginTop: mostrarAyuda ? 0 : 10 }}>
                        <AgendaEditor
                          agenda={diasQuincena}
                          diasOcultos={diasOcultos}
                          slotsOcultos={slotsOcultos}
                          onToggleSlot={toggleSlot}
                          onOcultarDia={toggleDiaOculto}
                          onToggleHoraEnTodos={toggleHoraEnTodos}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {seccion === 'texto' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Type size={16} color={colors.primary} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.subtext }}>
                      {t('sectionText')}
                    </span>
                  </div>
                  <TextoLibreInput
                    textoInput={textoInput}
                    setTextoInput={setTextoInput}
                    textosCanvas={textosCanvas}
                    mostrarEmojis={mostrarEmojis}
                    setMostrarEmojis={setMostrarEmojis}
                    editandoId={editandoId}
                    onAgregarTexto={agregarTexto}
                    onIniciarEdicion={iniciarEdicion}
                    onCancelarEdicion={cancelarEdicion}
                    onEliminarTexto={eliminarTexto}
                    onCambiarFontSize={cambiarFontSize}
                  />
                </div>
              )}

              {seccion === 'fondo' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <ImagePlus size={16} color={colors.primary} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.subtext }}>
                      {t('sectionBackground')}
                    </span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                      padding: '16px 0', borderRadius: 16, border: `1.5px dashed ${colors.primary}`,
                      backgroundColor: colors.primarySoft, color: colors.primaryDeep,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <ImagePlus size={18} strokeWidth={2} />
                    {t('changeBackgroundPhoto')}
                  </button>

                  {fondoFijoGuardado && (
                    <button
                      onClick={async () => {
                        const confirmado = await confirmDialog(
                          t('removeFixedBackgroundConfirm'),
                          { confirmText: t('removeFixedBackgroundConfirmButton'), cancelText: t('cancel'), danger: true }
                        );
                        if (confirmado) await quitarFondoFijo();
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 8,
                        marginTop: 8, fontSize: 12, fontWeight: 600, color: colors.subtext,
                        textDecoration: 'underline', textUnderlineOffset: 2,
                      }}
                    >
                      {t('removeFixedBackground')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ width: '100%', marginTop: 22, display: 'flex', gap: 10 }}>
              <button onClick={descargarImagen} style={footerActionStyle}>
                <Download size={18} strokeWidth={2} color={colors.text} />
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{t('save')}</span>
              </button>
              <button onClick={compartirImagen} style={{ ...footerActionStyle, backgroundColor: colors.whatsapp, border: 'none' }}>
                <Share2 size={18} strokeWidth={2} color={colors.primaryFg} />
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.primaryFg }}>{t('share')}</span>
              </button>
            </div>
          </>
        ) : (
          <div style={{
            width: canvasWidth, height: canvasHeight / 3,
            background: colors.surfaceSubtle, borderRadius: 20, border: `1px solid ${colors.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, marginBottom: 15,
          }}>
            <ImageOff size={36} strokeWidth={1.5} color={colors.muted} />
            <p style={{ color: colors.subtext, fontSize: 14, textAlign: 'center', padding: '0 30px', margin: 0 }}>
              {t('emptyState')}
            </p>
          </div>
        )}

        {/* Hidden file input for "Fondo" */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFondoChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — wraps in Suspense for useSearchParams
// ─────────────────────────────────────────────
export default function HistoriaPage() {
  const t = useTranslations('historia.HistoriaPage');
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: colors.subtext }}>{t('loading')}</div>}>
      <HistoriaContent />
    </Suspense>
  );
}
