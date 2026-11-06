export const THEMES = [
  { id: 'light', name: 'Light', colorScheme: 'light' },
  { id: 'dark', name: 'Dark', colorScheme: 'dark' },
  { id: 'champagne', name: 'Champagne', colorScheme: 'light' },
  { id: 'ocean', name: 'Ocean Breeze', colorScheme: 'light' },
  { id: 'rose', name: 'Rose Quartz', colorScheme: 'light' },
  { id: 'midnight', name: 'Midnight Gold', colorScheme: 'dark' },
  { id: 'emerald', name: 'Emerald Club', colorScheme: 'dark' },
  { id: 'amethyst', name: 'Royal Amethyst', colorScheme: 'dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_STORAGE_KEY = 'bill-splitter-theme';

export function resolveTheme(savedTheme: string | null, prefersDark: boolean): ThemeId {
  return THEMES.find((theme) => theme.id === savedTheme)?.id ?? (prefersDark ? 'dark' : 'light');
}

export function nextTheme(currentTheme: ThemeId): ThemeId {
  const nextIndex = (THEMES.findIndex((theme) => theme.id === currentTheme) + 1) % THEMES.length;
  return THEMES[nextIndex].id;
}
