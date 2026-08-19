// Catálogo declarativo para la historia de precios — 8 plantillas fijas
// (spec: price-story-templates). Un solo array, no un mapa keyed por id,
// así el picker (SelectorPlantilla) lo itera directo para armar el
// carrusel en el mismo orden en que están definidas acá.
//
// Roster reescrito 2026-08-18 (octava actualización, ver estilos.ts para
// el detalle completo): feature/fullbleed/split/beforeafter/collage/grid/
// catalog/listphoto — varias comparten Component (feature/listphoto ambas
// LayoutSingle; grid/catalog ambas LayoutGrid4) y se diferencian solo por
// mood/`align`, no por composición de fotos.
import { ComponentType, ReactNode } from 'react';
import { TemplateId } from '@/services/profesionalService';
import { LayoutSingle } from './layouts/LayoutSingle';
import { LayoutSplit2 } from './layouts/LayoutSplit2';
import { LayoutGrid4 } from './layouts/LayoutGrid4';
import { LayoutFullBleed } from './layouts/LayoutFullBleed';
import { LayoutCollage } from './layouts/LayoutCollage';
import { LayoutBeforeAfter } from './layouts/LayoutBeforeAfter';
import {
  EstiloTokens,
  estiloFeature, estiloFullBleed, estiloSplit, estiloBeforeAfter,
  estiloCollage, estiloGrid, estiloCatalog, estiloListPhoto,
} from './estilos';

export interface LayoutComponentProps {
  fotos:          string[];
  // Opacidad del scrim oscuro dibujado sobre la(s) foto(s) de fondo,
  // sourced de EstiloTokens.overlayOpacity de la plantilla activa (ver
  // estilos.ts).
  overlayOpacity: number;
  children:       ReactNode;
}

export interface TemplateEntry {
  id:        TemplateId;
  // Mínimo de fotos subidas para desbloquear esta plantilla en el picker
  // (spec: price-story-photos — "Layouts requiring more photos than
  // uploaded are locked"). Asignación de fotos a cada slot por `orden`
  // (reordenable vía drag-and-drop en GestorFotos).
  minFotos:  number;
  Component: ComponentType<LayoutComponentProps>;
  tokens:    EstiloTokens;
  // Chrome del panel de precios que HistoriaPreciosCanvas pasa a
  // TarjetaPrecios (ver su prop `variante`) — todas las plantillas usan
  // 'flotante' salvo `fullbleed`, que usa 'panel'.
  cardVariant: 'flotante' | 'panel';
  // Anclaje vertical de la tarjeta dentro del canvas, pasado a
  // TarjetaPrecios como su prop `align` — 'center' (default visual, la
  // mayoría), 'start' (tarjeta arriba, foto respira abajo) o 'end' (tarjeta
  // abajo, foto respira arriba). Nunca confina la ALTURA disponible de la
  // tarjeta (ver nota "octava actualización" en estilos.ts) — solo cambia
  // dónde se ancla dentro del alto completo del canvas.
  align: 'center' | 'start' | 'end';
}

// Orden = orden de presentación en el carrusel del picker. El fallback
// reactivo de SelectorPlantilla busca la PRIMERA entrada de este array cuyo
// minFotos entre en la cantidad de fotos actual.
//
// align: 'center' en TODAS — antes feature/catalog/listphoto anclaban la
// tarjeta abajo/arriba (align: 'end'/'start') a propósito, como parte de la
// variedad visual del catálogo (ver estilos.ts, comentario "octava
// actualización"). El usuario pidió centrar todas explícitamente (2026-08-19)
// — la variedad ahora sale solo de la composición de fotos y el mood/paleta.
export const TEMPLATES: TemplateEntry[] = [
  { id: 'feature',     minFotos: 1, Component: LayoutSingle,      tokens: estiloFeature,     cardVariant: 'flotante', align: 'center' },
  { id: 'fullbleed',   minFotos: 1, Component: LayoutFullBleed,   tokens: estiloFullBleed,   cardVariant: 'panel',    align: 'center' },
  { id: 'split',       minFotos: 2, Component: LayoutSplit2,      tokens: estiloSplit,       cardVariant: 'flotante', align: 'center' },
  { id: 'beforeafter', minFotos: 2, Component: LayoutBeforeAfter, tokens: estiloBeforeAfter, cardVariant: 'flotante', align: 'center' },
  { id: 'collage',     minFotos: 3, Component: LayoutCollage,     tokens: estiloCollage,     cardVariant: 'flotante', align: 'center' },
  { id: 'grid',        minFotos: 4, Component: LayoutGrid4,       tokens: estiloGrid,        cardVariant: 'flotante', align: 'center' },
  { id: 'catalog',     minFotos: 4, Component: LayoutGrid4,       tokens: estiloCatalog,     cardVariant: 'flotante', align: 'center' },
  { id: 'listphoto',   minFotos: 1, Component: LayoutSingle,      tokens: estiloListPhoto,   cardVariant: 'flotante', align: 'center' },
];
