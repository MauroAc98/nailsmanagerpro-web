'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useGenerarHistoria, Modo } from '@/hooks/useGenerarHistoria';
import { StoryCanvas } from '@/components/historia/StoryCanvas';
import { TextoLibreInput } from '@/components/historia/TextoLibreInput';
import { AgendaEditor } from '@/components/historia/AgendaEditor';
import { useProfesionalStore } from '@/store/useProfesionalStore';

// ─────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────
const tabContainerStyle: React.CSSProperties = {
  display: 'flex', background: '#EBEBEB', borderRadius: 20, padding: 3, marginBottom: 14,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, textAlign: 'center', padding: '8px 18px', borderRadius: 17, border: 'none',
    cursor: 'pointer',
    background:  active ? colors.primary : 'transparent',
    color:       active ? '#fff' : '#999',
    fontWeight:  700, fontSize: 11, letterSpacing: active ? 0 : 0.5,
    boxShadow:   active ? `0 2px 6px ${colors.primary}4D` : 'none',
  };
}

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function HistoriaContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const fechaInicial = searchParams.get('fecha') ?? undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    modo, quincena, diasOcultos,
    agendaGenerada, diasQuincena, diasAMostrar, hayContenido, titulo, tituloNav,
    textosCanvas, textoInput, setTextoInput, mostrarEmojis, setMostrarEmojis, editandoId,
    canvasRef, canvasWidth, canvasHeight,
    selectedProfesionalId, setSelectedProfesionalId,
    handleModo, handleNavegar, setQuincena, setDiasOcultos,
    toggleDiaOculto, toggleSlot,
    agregarTexto, iniciarEdicion, cancelarEdicion,
    actualizarPosicion, eliminarTexto, cambiarFontSize, redimensionarTexto,
    elegirFoto, descargarImagen, compartirImagen, fondoUri,
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

  const handleFondoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) elegirFoto(file);
    e.target.value = '';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Generar historia</h1>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Mode tabs */}
        <div style={{ ...tabContainerStyle, width: '100%' }}>
          {(['dia', 'semana', 'mes'] as Modo[]).map(m => (
            <button key={m} onClick={() => handleModo(m)} style={tabStyle(modo === m)}>
              {m === 'dia' ? 'DÍA' : m === 'semana' ? 'SEMANA' : 'MES'}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => handleNavegar(-1)}
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(215,158,164,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{
            flex: 1, textTransform: 'uppercase', fontWeight: 700, fontSize: 13,
            letterSpacing: 1, textAlign: 'center', color: colors.text,
          }}>
            {tituloNav}
          </span>
          <button
            onClick={() => handleNavegar(1)}
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(215,158,164,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Quincena tabs */}
        {modo === 'mes' && (
          <div style={{ ...tabContainerStyle, width: '100%' }}>
            {[0, 1].map(i => (
              <button
                key={i}
                onClick={() => { setQuincena(i as 0 | 1); setDiasOcultos([]); }}
                style={tabStyle(quincena === i)}
              >
                {i === 0 ? '1 — 15' : '16 — Fin'}
              </button>
            ))}
          </div>
        )}

        {/* Selector de profesional — invisible con ≤1 profesional activa */}
        {mostrarSelectorProfesional && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 14 }}>
            {activeProfesionales.map(p => {
              const selected = selectedProfesionalId === p.id;
              const color    = p.color || colors.primary;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfesionalId(selected ? null : p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 20, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                    border: `1px solid ${selected ? color : '#DDD'}`,
                    backgroundColor: selected ? color : '#FFF',
                    color: selected ? '#FFF' : colors.text,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                    backgroundColor: selected ? '#FFF' : color,
                  }} />
                  {p.nombre}
                </button>
              );
            })}
          </div>
        )}

        {/* Canvas + controls, or empty state */}
        {hayContenido ? (
          <>
            <StoryCanvas
              ref={canvasRef}
              titulo={titulo}
              profesionalNombre={profesionalSeleccionada?.nombre}
              dias={diasAMostrar}
              fondoUri={fondoUri}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              textosLibres={textosCanvas}
              onMoverTexto={actualizarPosicion}
              onResizeTexto={redimensionarTexto}
              onEditarTexto={iniciarEdicion}
            />

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

            {agendaGenerada.length > 0 && (
              <div style={{ width: '100%', marginTop: 25 }}>
                <AgendaEditor
                  agenda={diasQuincena}
                  diasOcultos={diasOcultos}
                  onToggleSlot={toggleSlot}
                  onOcultarDia={toggleDiaOculto}
                />
              </div>
            )}

            {/* Footer actions */}
            <div style={{ width: '100%', marginTop: 25, display: 'flex', gap: 10 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE', cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Fondo</span>
              </button>
              <button
                onClick={descargarImagen}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE', cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Guardar</span>
              </button>
              <button
                onClick={compartirImagen}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE', cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Compartir</span>
              </button>
            </div>
          </>
        ) : (
          <div style={{
            width: canvasWidth, height: canvasHeight / 3,
            background: '#F9F9F9', borderRadius: 16, border: '1px solid #EEE',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, marginBottom: 15,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="9.5" y1="13.5" x2="14.5" y2="18.5" />
              <line x1="14.5" y1="13.5" x2="9.5" y2="18.5" />
            </svg>
            <p style={{ color: '#AAA', fontSize: 14, textAlign: 'center', padding: '0 30px', margin: 0 }}>
              No hay disponibilidad para mostrar en este período
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
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando...</div>}>
      <HistoriaContent />
    </Suspense>
  );
}
