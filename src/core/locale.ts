import { ar as dateAr, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "./i18n";

export const LOCALES = ["en", "ar"] as const;
export type LocaleId = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: LocaleId = "en";

export function isLocaleId(value: unknown): value is LocaleId {
  return value === "en" || value === "ar";
}

export function normalizeLocale(value: unknown): LocaleId {
  return isLocaleId(value) ? value : DEFAULT_LOCALE;
}

export function currentLocale(): LocaleId {
  return normalizeLocale(i18n.resolvedLanguage || i18n.language);
}

export function intlLocale(locale: LocaleId = currentLocale()): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en";
}

export function dateFnsLocale(locale: LocaleId = currentLocale()): Locale {
  return locale === "ar" ? dateAr : enUS;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function latinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

const LOGIN_LOCALE = "life-os-login-locale";

export function rememberedLocale(): LocaleId | null {
  try {
    const value = localStorage.getItem(LOGIN_LOCALE);
    return isLocaleId(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberLocale(value: LocaleId) {
  try { localStorage.setItem(LOGIN_LOCALE, value); } catch { /* private mode */ }
}

export async function applyLocale(value: unknown): Promise<LocaleId> {
  const locale = normalizeLocale(value);
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  if (i18n.language !== locale) await i18n.changeLanguage(locale);
  return locale;
}

const SERVER_ERRORS: Record<string, string> = {
  "Name is required": "errors.nameRequired",
  "A valid email is required": "errors.emailInvalid",
  "Password must be at least 8 characters": "errors.passwordShort",
  "Setup is closed": "errors.setupClosed",
  "That email is already in use": "errors.emailTaken",
  "Unknown user": "errors.unknownUser",
  "You cannot disable your own account": "errors.cannotDisableSelf",
  "At least one active admin is required": "errors.needAdmin",
  "Invalid email or password": "errors.badLogin",
  "Current password is wrong": "errors.currentPassword",
  "Sign in required": "errors.signInRequired",
  "Forbidden": "errors.forbidden",
  "The server is not responding": "errors.serverDown",
  "Sign in failed": "errors.signInFailed",
  "Request failed": "errors.requestFailed",
  "Not found": "errors.notFound",
  "Could not save theme": "errors.saveTheme",
  "Could not save language": "errors.saveLanguage",
  "Unknown error": "errors.unknown",
  "Pick a valid date": "errors.activityDates",
  "The end date is before the start date": "errors.activityRange",
};

export function translateError(message: string): string {
  const key = SERVER_ERRORS[message];
  return key ? i18n.t(key) : message;
}
