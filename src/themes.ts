export const THEMES = [
  { id: 'light', name: 'Light', colorScheme: 'light' },
  { id: 'dark', name: 'Dark', colorScheme: 'dark' },
  { id: 'kyoto-berry', name: 'Kyoto Berry', colorScheme: 'light' },
  { id: 'ocean', name: 'Ocean Breeze', colorScheme: 'light' },
  { id: 'rose', name: 'Rose Quartz', colorScheme: 'light' },
  { id: 'nordic-slate', name: 'Nordic Slate', colorScheme: 'dark' },
  { id: 'solar-dune', name: 'Solar Dune', colorScheme: 'dark' },
  { id: 'amethyst', name: 'Royal Amethyst', colorScheme: 'dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_STORAGE_KEY = 'bill-splitter-theme';

const LEGACY_THEME_MIGRATION = new Map<string, ThemeId>([
  ['champagne', 'kyoto-berry'],
  ['emerald', 'solar-dune'],
  ['emerald-club', 'solar-dune'],
  ['midnight', 'nordic-slate'],
  ['midnight-gold', 'nordic-slate'],
]);

export function resolveTheme(savedTheme: string | null, prefersDark: boolean): ThemeId {
  const normalizedTheme = savedTheme === null ? null : LEGACY_THEME_MIGRATION.get(savedTheme) ?? savedTheme;
  return THEMES.find((theme) => theme.id === normalizedTheme)?.id ?? (prefersDark ? 'dark' : 'light');
}

export function nextTheme(currentTheme: ThemeId): ThemeId {
  const nextIndex = (THEMES.findIndex((theme) => theme.id === currentTheme) + 1) % THEMES.length;
  return THEMES[nextIndex].id;
}
