'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { TemplateId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { showToast } from '@/store/useToastStore';
import { TEMPLATES } from './catalogo';
import { MiniaturaCanvas } from './MiniaturaCanvas';

const THUMB_WIDTH = 104;

interface Props {
  // Memoized `data:` photo URLs, already resolved upstream (see
  // useHistoriaPrecios) — reused by reference across las 8 miniaturas del
  // carrusel así cada foto se resuelve una sola vez total, no una vez por
  // plantilla. SelectorPlantilla nunca fetchea ni muta este array.
  fotos:          string[];
  // Título de la tarjeta para el modo activo (precios/promociones), mismo
  // valor que recibe TarjetaPrecios directamente — cada miniatura
  // previsualiza el título real, no un placeholder (spec: "Picker previews
  // with real data").
  titulo:         string;
  // Lista ya filtrada de Servicios activos, misma que espera TarjetaPrecios
  // — este componente es puramente presentacional, no lee el store.
  servicios:      Servicio[];
  // Crédito de pie de cuenta (nombre de negocio/teléfono), mismos valores
  // que recibe TarjetaPrecios directamente — cada miniatura previsualiza el
  // mismo contenido real de pie que renderiza la exportación (spec:
  // "Picker previews with real data", design decision D3).
  nombreNegocio:  string;
  telefono:       string | null;
  profesionalNombre?: string;
  nota?:          string;
  notaAlineacion?: 'left' | 'center' | 'right' | 'justify';
  templateId:       TemplateId;
  onTemplateChange: (id: TemplateId) => void;
}

// SelectorPlantilla — carrusel horizontal de 8 plantillas (spec:
// price-story-templates, catálogo plano). Cada miniatura renderiza a través
// del MISMO HistoriaPreciosCanvas/MiniaturaCanvas que captura la
// exportación final (ver D3), previsualizada con las fotos y precios reales
// de quien llama — nunca contenido placeholder (spec: "Picker previews with
// real data").
export function SelectorPlantilla({
  fotos, titulo, servicios, nombreNegocio, telefono, profesionalNombre, nota, notaAlineacion, templateId, onTemplateChange,
}: Props) {
  const t = useTranslations('historia.SelectorPlantilla');

  // Fallback reactivo — si se borra una foto (GestorFotos) y la plantilla
  // ACTUALMENTE elegida deja de entrar en el `fotos` prop en vivo, cae a la
  // primera entrada de TEMPLATES cuyo minFotos entre (ver catalogo.ts).
  // Este efecto solo se autocorrige con lo que le llega en `fotos` — no
  // dueño ni renderiza ninguna UI de borrado.
  useEffect(() => {
    const templateActual = TEMPLATES.find(pl => pl.id === templateId);
    if (!templateActual) return;
    if (fotos.length < templateActual.minFotos) {
      const fallback = TEMPLATES.find(pl => pl.minFotos <= fotos.length);
      if (fallback && fallback.id !== templateId) {
        onTemplateChange(fallback.id);
        showToast(t('fallbackToast'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.length, templateId, onTemplateChange]);

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginLeft: -4, paddingLeft: 4, scrollSnapType: 'x mandatory' }}>
      {TEMPLATES.map(template => {
        const bloqueado    = fotos.length < template.minFotos;
        const seleccionado = templateId === template.id;
        const faltan       = template.minFotos - fotos.length;

        return (
          <button
            key={template.id}
            type="button"
            disabled={bloqueado}
            onClick={() => onTemplateChange(template.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              flexShrink: 0, scrollSnapAlign: 'start',
              padding: 5, borderRadius: 16, cursor: bloqueado ? 'not-allowed' : 'pointer',
              background: seleccionado ? withAlpha(colors.primary, '1F') : 'transparent',
              border: `1.5px solid ${seleccionado ? colors.primaryDeep : colors.border}`,
              opacity: bloqueado ? 0.45 : 1,
            }}
          >
            <MiniaturaCanvas
              templateId={template.id}
              fotos={fotos}
              titulo={titulo}
              servicios={servicios}
              nombreNegocio={nombreNegocio}
              telefono={telefono}
              profesionalNombre={profesionalNombre}
              nota={nota}
              notaAlineacion={notaAlineacion}
              width={THUMB_WIDTH}
            />
            <span style={{ fontFamily: agendaFontSerif, fontSize: 11, fontWeight: 600, color: colors.textStrong, whiteSpace: 'nowrap' }}>
              {t(`templates.${template.id}.name`)}
            </span>
            <span style={{ fontSize: 9, fontWeight: 500, color: colors.subtext, whiteSpace: 'nowrap' }}>
              {bloqueado ? t('missingPhotos', { count: faltan }) : t(`templates.${template.id}.note`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
