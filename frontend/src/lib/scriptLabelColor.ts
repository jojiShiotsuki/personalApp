// Deterministic label → Tailwind palette-token mapping for Cold Calls
// script A/B labels. Same input string always yields the same swatch so
// labels stay visually stable across sessions and prospects.

const LABEL_PALETTE = [
  { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
] as const;

export type ScriptLabelTokens = (typeof LABEL_PALETTE)[number];

export function getScriptLabelTokens(label: string): ScriptLabelTokens {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length];
}
