// Catálogo declarativo para la historia de precios — 8 plantillas fijas
// (spec: price-story-templates, migrado del catálogo original de 3 layouts
// x 3 estilos a un catálogo plano por decisión explícita, ver plan de
// migración). Un solo array, no un mapa keyed por id, así el picker
// (SelectorPlantilla) lo itera directo para armar el carrusel en el mismo
// orden en que están definidas acá.
import { ComponentType, ReactNode } from 'react';
import { TemplateId } from '@/services/profesionalService';
import { LayoutSingle } from './layouts/LayoutSingle';
import { LayoutSplit2 } from './layouts/LayoutSplit2';
import { LayoutGrid4 } from './layouts/LayoutGrid4';
import { LayoutFullBleed } from './layouts/LayoutFullBleed';
import { LayoutCollage } from './layouts/LayoutCollage';
import { LayoutTipografico } from './layouts/LayoutTipografico';
import {
  EstiloTokens,
  estiloEditorial, estiloMinimal, estiloModern, estiloSplit,
  estiloCollage, estiloFullBleed, estiloType, estiloGrid,
} from './estilos';

export interface LayoutComponentProps {
  fotos:          string[];
  // Opacidad del scrim oscuro dibujado sobre la(s) foto(s) de fondo,
  // sourced de EstiloTokens.overlayOpacity de la plantilla activa (ver
  // estilos.ts) — las plantillas claras (editorial/minimal/fullbleed)
  // necesitan mucho menos scrim que las oscuras (modern/collage).
  overlayOpacity: number;
  children:       ReactNode;
}

export interface TemplateEntry {
  id:        TemplateId;
  // Mínimo de fotos subidas para desbloquear esta plantilla en el picker
  // (spec: price-story-photos — "Layouts requiring more photos than
  // uploaded are locked"). Asignación de fotos a cada slot por `orden`
  // (reordenable vía drag-and-drop en GestorFotos). `type` (Tipográfico) es
  // la única plantilla con minFotos: 0 — nunca se bloquea, ni sin fotos.
  minFotos:  number;
  Component: ComponentType<LayoutComponentProps>;
  tokens:    EstiloTokens;
  // Chrome del panel de precios que HistoriaPreciosCanvas pasa a
  // TarjetaPrecios (ver su prop `variante`) — todas las plantillas usan
  // 'flotante' salvo `fullbleed`, que usa 'panel'.
  cardVariant: 'flotante' | 'panel';
}

// Orden = orden de presentación en el carrusel del picker. El fallback
// reactivo de SelectorPlantilla busca la PRIMERA entrada de este array cuyo
// minFotos entre en la cantidad de fotos actual — con este orden, esa
// búsqueda solo cae en `type` (al final, minFotos: 0) cuando ninguna de las
// que piden foto(s) entra, que es exactamente el caso de 0 fotos.
export const TEMPLATES: TemplateEntry[] = [
  { id: 'editorial', minFotos: 1, Component: LayoutSingle,      tokens: estiloEditorial,  cardVariant: 'flotante' },
  { id: 'minimal',   minFotos: 1, Component: LayoutSingle,      tokens: estiloMinimal,    cardVariant: 'flotante' },
  { id: 'modern',    minFotos: 1, Component: LayoutSingle,      tokens: estiloModern,     cardVariant: 'flotante' },
  { id: 'split',     minFotos: 2, Component: LayoutSplit2,      tokens: estiloSplit,      cardVariant: 'flotante' },
  { id: 'collage',   minFotos: 3, Component: LayoutCollage,     tokens: estiloCollage,    cardVariant: 'flotante' },
  { id: 'fullbleed', minFotos: 1, Component: LayoutFullBleed,   tokens: estiloFullBleed,  cardVariant: 'panel' },
  { id: 'type',      minFotos: 0, Component: LayoutTipografico, tokens: estiloType,       cardVariant: 'flotante' },
  { id: 'grid',      minFotos: 4, Component: LayoutGrid4,       tokens: estiloGrid,       cardVariant: 'flotante' },
];
