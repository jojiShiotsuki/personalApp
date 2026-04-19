/**
 * Precomputed Tailwind class bundles for user-pickable step colors on
 * CUSTOM (Other...) sequence steps. Tailwind's JIT requires class names to
 * appear verbatim in source, so every variant is listed explicitly.
 *
 * Keys are stored on MultiTouchStep.custom_color. The frontend resolves
 * the key to classes; backend stays opaque.
 */

export type StepColorKey =
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'rose'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'slate';

export interface StepColorTokens {
  /** Light accent for icon/label text. */
  accent: string;
  /** Top border for kanban columns. */
  border: string;
  /** Pill background + text for count badges. */
  badge: string;
  /** Solid background for the swatch chip in the picker. */
  swatch: string;
}

export const STEP_COLOR_PALETTE: Record<StepColorKey, StepColorTokens> = {
  cyan: {
    accent: 'text-cyan-400',
    border: 'border-t-cyan-500',
    badge: 'bg-cyan-500/20 text-cyan-400',
    swatch: 'bg-cyan-500',
  },
  blue: {
    accent: 'text-blue-400',
    border: 'border-t-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
    swatch: 'bg-blue-500',
  },
  purple: {
    accent: 'text-purple-400',
    border: 'border-t-purple-500',
    badge: 'bg-purple-500/20 text-purple-400',
    swatch: 'bg-purple-500',
  },
  pink: {
    accent: 'text-pink-400',
    border: 'border-t-pink-500',
    badge: 'bg-pink-500/20 text-pink-400',
    swatch: 'bg-pink-500',
  },
  rose: {
    accent: 'text-rose-400',
    border: 'border-t-rose-500',
    badge: 'bg-rose-500/20 text-rose-400',
    swatch: 'bg-rose-500',
  },
  orange: {
    accent: 'text-orange-400',
    border: 'border-t-orange-500',
    badge: 'bg-orange-500/20 text-orange-400',
    swatch: 'bg-orange-500',
  },
  amber: {
    accent: 'text-amber-400',
    border: 'border-t-amber-500',
    badge: 'bg-amber-500/20 text-amber-400',
    swatch: 'bg-amber-500',
  },
  yellow: {
    accent: 'text-yellow-400',
    border: 'border-t-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-400',
    swatch: 'bg-yellow-500',
  },
  green: {
    accent: 'text-green-400',
    border: 'border-t-green-500',
    badge: 'bg-green-500/20 text-green-400',
    swatch: 'bg-green-500',
  },
  emerald: {
    accent: 'text-emerald-400',
    border: 'border-t-emerald-500',
    badge: 'bg-emerald-500/20 text-emerald-400',
    swatch: 'bg-emerald-500',
  },
  teal: {
    accent: 'text-teal-400',
    border: 'border-t-teal-500',
    badge: 'bg-teal-500/20 text-teal-400',
    swatch: 'bg-teal-500',
  },
  slate: {
    accent: 'text-slate-400',
    border: 'border-t-slate-500',
    badge: 'bg-slate-500/20 text-slate-400',
    swatch: 'bg-slate-500',
  },
};

export const STEP_COLOR_KEYS: StepColorKey[] = [
  'cyan',
  'blue',
  'teal',
  'emerald',
  'green',
  'yellow',
  'amber',
  'orange',
  'rose',
  'pink',
  'purple',
  'slate',
];

/** Default accent when custom_color is null/unknown. */
export const DEFAULT_CUSTOM_COLOR: StepColorKey = 'cyan';

export function getStepColor(key: string | null | undefined): StepColorTokens {
  if (key && key in STEP_COLOR_PALETTE) {
    return STEP_COLOR_PALETTE[key as StepColorKey];
  }
  return STEP_COLOR_PALETTE[DEFAULT_CUSTOM_COLOR];
}
