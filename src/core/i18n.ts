import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "@/locales/en";
import { ar } from "@/locales/ar";

function assertCatalog(left: unknown, right: unknown, path = "catalog"): void {
  if (typeof left === "string" || typeof right === "string") {
    if (typeof left !== "string" || typeof right !== "string") throw new Error(`Locale shape mismatch at ${path}`);
    return;
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    throw new Error(`Locale shape mismatch at ${path}`);
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.join() !== rightKeys.join()) throw new Error(`Locale keys mismatch at ${path}`);
  for (const key of leftKeys) {
    assertCatalog((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

assertCatalog(en, ar);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
