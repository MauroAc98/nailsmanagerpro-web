'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FotoHistoria } from '@/services/profesionalService';
import { resizeFondoFile } from '@/lib/historia/captura';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { colors, withAlpha } from '@/theme/colors';

const SLOT_SIZE = 88;

interface Props {
  // Profesional cuyas fotos de historia de precios se gestionan — GestorFotos
  // llama subirFotoHistoriaPrecios/borrarFotoHistoriaPrecios con este id
  // directamente (mismo patrón que useGenerarHistoria.elegirFoto con
  // guardarFondoHistoria/borrarFondoHistoria). No lee `profesionales` del
  // store: la lista de fotos vigente llega siempre por prop, así el padre
  // (hook de Fase 5) sigue siendo la única fuente de verdad del Profesional
  // completo.
  profesionalId: number;
  // Fotos actuales de la historia de precios. Prop-driven, no state local —
  // se re-renderiza solo cuando el padre vuelve a pasar la lista nueva
  // (después de que subir/borrar actualiza el store). Se ordenan acá por
  // `orden` antes de pintar la grilla.
  fotos: FotoHistoria[];
}

// Convierte un File a data: URL sin pasar por resizeFondoFile — mismo
// fallback que usa useGenerarHistoria.elegirFoto cuando el resize falla
// (formato no soportado, canvas bloqueado, etc.), así el tile optimista
// nunca se queda sin preview.
function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// GestorFotos — grilla de fotos dedicadas a la historia de precios (spec:
// price-story-photos, "Upload dedicated story photos": no auto-popula desde
// ninguna otra fuente de fotos existente). La subida acepta selección
// múltiple pero sube de a una, SECUENCIALMENTE — awaiteando cada
// subirFotoHistoriaPrecios antes de arrancar la siguiente — porque cada
// respuesta trae el Profesional completo; subir en paralelo haría que las
// respuestas se pisaran entre sí sobre el mismo reducer `map` del store
// (design D4). Cada foto en vuelo (subida o borrado) muestra un spinner en
// su propio slot en vez de bloquear la grilla entera.
export function GestorFotos({ profesionalId, fotos }: Props) {
  const t = useTranslations('historia.GestorFotos');
  const { subirFotoHistoriaPrecios, borrarFotoHistoriaPrecios } = useProfesionalStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  // Previews optimistas en cola FIFO — como la subida es estrictamente
  // secuencial, el primer preview de la cola siempre corresponde al archivo
  // que está subiéndose en ese momento; se descarta apenas esa subida
  // resuelve (éxito o error), nunca por índice/id porque el slot real
  // todavía no existe mientras la foto está en vuelo.
  const [previews, setPreviews] = useState<string[]>([]);
  const [borrandoId, setBorrandoId] = useState<number | null>(null);

  const fotosOrdenadas = [...fotos].sort((a, b) => a.orden - b.orden);

  const handleAgregarClick = () => {
    if (subiendo) return;
    fileInputRef.current?.click();
  };

  const handleFilesElegidos = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (archivos.length === 0) return;

    setSubiendo(true);
    for (const archivo of archivos) {
      let archivoParaSubir = archivo;
      let preview: string;
      try {
        const resized = await resizeFondoFile(archivo);
        archivoParaSubir = resized.file;
        preview = resized.dataUrl;
      } catch {
        preview = await leerComoDataUrl(archivo);
      }

      setPreviews(prev => [...prev, preview]);

      // Secuencial a propósito (ver D4) — cada await bloquea el próximo
      // archivo de la cola hasta que este termina.
      const resultado = await subirFotoHistoriaPrecios(profesionalId, archivoParaSubir);

      // FIFO: la subida recién resuelta es siempre la más vieja de la cola.
      setPreviews(prev => prev.slice(1));

      if (!resultado.success) {
        await alertDialog(resultado.message ?? t('uploadError'));
      }
    }
    setSubiendo(false);
  };

  const handleBorrar = async (foto: FotoHistoria) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm'),
      { confirmText: t('deleteConfirmButton'), cancelText: t('cancel'), danger: true }
    );
    if (!confirmado) return;

    setBorrandoId(foto.id);
    const resultado = await borrarFotoHistoriaPrecios(profesionalId, foto.id);
    setBorrandoId(null);

    if (!resultado.success) {
      await alertDialog(resultado.message ?? t('deleteError'));
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${SLOT_SIZE}px)`, gap: 10 }}>
        {fotosOrdenadas.map(foto => (
          <div
            key={foto.id}
            style={{
              position: 'relative', width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 12,
              overflow: 'hidden', border: `1.5px solid ${colors.border}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- requerido por el pipeline de captura de html-to-image, mismo patrón que StoryCanvas/LayoutGrid4 */}
            <img
              src={foto.url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {borrandoId === foto.id ? (
              <SlotSpinnerOverlay />
            ) : (
              <button
                type="button"
                onClick={() => handleBorrar(foto)}
                aria-label={t('deletePhotoAria')}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
                  border: `1px solid ${colors.dangerBorder}`, background: colors.dangerBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {previews.map((preview, i) => (
          <div
            key={`preview-${i}`}
            style={{
              position: 'relative', width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 12,
              overflow: 'hidden', border: `1.5px solid ${colors.border}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ídem arriba, preview optimista del mismo pipeline */}
            <img
              src={preview}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.6 }}
            />
            <SlotSpinnerOverlay />
          </div>
        ))}

        <button
          type="button"
          onClick={handleAgregarClick}
          disabled={subiendo}
          aria-label={t('addPhotosAria')}
          style={{
            width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 12,
            border: `1.5px dashed ${colors.border}`, background: colors.surfaceSubtle,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: subiendo ? 'not-allowed' : 'pointer', opacity: subiendo ? 0.6 : 1,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesElegidos}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// Overlay de spinner reutilizando la animación CSS global (.loader-spinner,
// app/globals.css) — mismo mecanismo que components/Loader.tsx pero
// contenido dentro de un slot puntual en vez de fullscreen.
function SlotSpinnerOverlay() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: withAlpha(colors.surface, 'B3'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="loader-spinner"
        style={{
          width: 22, height: 22, borderRadius: 11,
          border: `3px solid ${colors.border}`,
          borderTopColor: colors.primary,
        }}
      />
    </div>
  );
}
