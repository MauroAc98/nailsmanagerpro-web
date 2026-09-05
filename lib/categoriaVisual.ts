import type { LucideIcon } from 'lucide-react';
import { Circle, Square, Triangle, Diamond, Hexagon, Pentagon, Octagon, Squircle, Tag } from 'lucide-react';
import { withAlpha } from '@/theme/colors';
import { agendaColors } from '@/theme/agendaColors';

export interface CategoriaVisual {
  icon:       LucideIcon; // rendered as <Icon size={18} strokeWidth={2} color={tintStrong} />
  tint:       string;     // translucent circle fill — CONSTANT across every category
  tintStrong: string;     // icon stroke + accent text — CONSTANT across every category
}

// 8 abstract shapes, ordered so stride-5 neighbours look visually distinct.
// Color is deliberately NOT part of this palette — every category renders in
// the same single brand accent (agendaColors.primary/primaryDeep). A
// per-category hue was tried in the original mockup/design and rejected by
// the user as off-brand ("un arcoiris"); shape alone carries the
// differentiation. See design D3.
const ICONS: ReadonlyArray<LucideIcon> = [Circle, Square, Triangle, Diamond, Hexagon, Pentagon, Octagon, Squircle];

const PALETTE_SIZE = ICONS.length; // 8
const SLOT_STRIDE  = 5;            // gcd(5, 8) === 1 → bijection, see D1

const TINT        = withAlpha(agendaColors.primary, '15'); // same treatment the star icon used
const TINT_STRONG = agendaColors.primaryDeep;

const NEUTRAL: CategoriaVisual = {
  icon:       Tag,
  tint:       withAlpha(agendaColors.muted, '24'),
  tintStrong: agendaColors.sub,
};

export function categoriaSlot(id: number): number {
  return (Math.abs(Math.trunc(id)) * SLOT_STRIDE) % PALETTE_SIZE;
}

// `null` = "Sin categoría" → neutral identity, never a palette slot.
export function categoriaVisual(id: number | null): CategoriaVisual {
  if (id === null) return NEUTRAL;
  return { icon: ICONS[categoriaSlot(id)], tint: TINT, tintStrong: TINT_STRONG };
}
