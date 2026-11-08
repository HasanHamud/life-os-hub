export const THEME_IDS = ["warm-dark", "main-light", "forest", "midnight"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  mode: "dark" | "light";
  swatches: readonly [string, string, string, string];
}

export const DEFAULT_THEME: ThemeId = "forest";

export const THEMES: readonly ThemeOption[] = [
  {
    id: "warm-dark",
    name: "Warm Dark",
    description: "Dark brown, cream, and gold.",
    mode: "dark",
    swatches: ["#1C1814", "#241F1B", "#E4B56A", "#F3ECE3"],
  },
  {
    id: "main-light",
    name: "Main Light",
    description: "Warm paper and terracotta.",
    mode: "light",
    swatches: ["#F6F3EE", "#FFFCFA", "#C44732", "#1C1A17"],
  },
  {
    id: "forest",
    name: "Forest Sand",
    description: "Sand and forest green.",
    mode: "light",
    swatches: ["#E7E1D2", "#EFE9DC", "#1E4D3A", "#1A332B"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Navy and gold.",
    mode: "dark",
    swatches: ["#10182C", "#162036", "#E6C15C", "#E8E6F0"],
  },
] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function normalizeTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

const LOGIN_THEME = "life-os-login-theme";

export function rememberedTheme(): ThemeId | null {
  try {
    const value = localStorage.getItem(LOGIN_THEME);
    return isThemeId(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberTheme(value: ThemeId) {
  try { localStorage.setItem(LOGIN_THEME, value); } catch { /* private mode */ }
}

export function applyTheme(value: unknown): ThemeId {
  const theme = normalizeTheme(value);
  const option = THEMES.find((item) => item.id === theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = option?.mode ?? "dark";
  return theme;
}
