export const THEME_IDS = ["warm-dark", "main-light", "forest", "midnight"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  mode: "dark" | "light";
  swatches: readonly [string, string, string, string];
}

export const DEFAULT_THEME: ThemeId = "warm-dark";

export const THEMES: readonly ThemeOption[] = [
  {
    id: "warm-dark",
    name: "Warm Dark",
    description: "The original warm, focused Life OS palette.",
    mode: "dark",
    swatches: [
      "oklch(0.16 0.012 60)",
      "oklch(0.20 0.013 62)",
      "oklch(0.78 0.13 70)",
      "oklch(0.30 0.022 70)",
    ],
  },
  {
    id: "main-light",
    name: "Main Light",
    description: "Warm paper, indigo, and amber.",
    mode: "light",
    swatches: ["#FAF7F2", "#FFFFFF", "#4F46B8", "#F59E0B"],
  },
  {
    id: "forest",
    name: "Forest Sand",
    description: "Sand, forest green, and terracotta.",
    mode: "light",
    swatches: ["#F4EFE6", "#FBF8F3", "#1F4D3A", "#D9734E"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Navy, teal, and violet.",
    mode: "dark",
    swatches: ["#0F172A", "#172033", "#2DD4BF", "#8B5CF6"],
  },
] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function normalizeTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function applyTheme(value: unknown): ThemeId {
  const theme = normalizeTheme(value);
  const option = THEMES.find((item) => item.id === theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = option?.mode ?? "dark";
  return theme;
}
