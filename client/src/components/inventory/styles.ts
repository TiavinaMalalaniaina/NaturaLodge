// Classes communes aux formulaires de l'inventaire, alignées sur celles des autres fenêtres (dépenses, chambres).
export const INPUT_CLASS = 'w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
export const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5';
export const PRIMARY_BUTTON_CLASS = 'flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50';
export const SECONDARY_BUTTON_CLASS = 'px-6 py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all';

// Champ numérique facultatif : '' → null, sinon entier positif ou nul.
export function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
