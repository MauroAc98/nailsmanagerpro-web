// Declarative catalog for the price story — 3 layouts x 3 estilos = 9 fixed
// combinations (spec: price-story-templates). Both registries are plain
// arrays, not maps keyed by id, so the picker (SelectorPlantilla) can
// iterate them directly to build the 3x3 grid without a separate ordering
// list.
import { ComponentType, ReactNode } from 'react';
import { LayoutId, EstiloId } from '@/services/profesionalService';
import { LayoutSingle } from './layouts/LayoutSingle';
import { LayoutSplit2 } from './layouts/LayoutSplit2';
import { LayoutGrid4 } from './layouts/LayoutGrid4';
import { EstiloTokens, estiloClassic, estiloModern, estiloBold } from './estilos';

export interface LayoutComponentProps {
  fotos:    string[];
  children: ReactNode;
}

export interface LayoutEntry {
  id:        LayoutId;
  // Minimum uploaded photos required to unlock this layout in the picker
  // (spec: price-story-photos — "Layouts requiring more photos than
  // uploaded are locked"). Slot assignment is by upload order (`orden`),
  // no drag reorder in v1 — see design D4.
  minFotos:  number;
  Component: ComponentType<LayoutComponentProps>;
}

// Ordered so 'single' is first — SelectorPlantilla's reactive fallback
// (task 3.8) always falls back to 'single' because it's the only layout
// that's never locked once at least 1 photo exists (minFotos: 1).
export const LAYOUTS: LayoutEntry[] = [
  { id: 'single', minFotos: 1, Component: LayoutSingle },
  { id: 'split2', minFotos: 2, Component: LayoutSplit2 },
  { id: 'grid4',  minFotos: 4, Component: LayoutGrid4 },
];

export interface EstiloEntry {
  id:     EstiloId;
  tokens: EstiloTokens;
}

export const ESTILOS: EstiloEntry[] = [
  { id: 'classic', tokens: estiloClassic },
  { id: 'modern',  tokens: estiloModern },
  { id: 'bold',    tokens: estiloBold },
];
