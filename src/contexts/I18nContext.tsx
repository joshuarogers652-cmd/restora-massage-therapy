import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import type { Locale } from "@/types";

const dictionaries = { en, es } as const;
const STORAGE_KEY = "restora.locale"; // a display preference only — never personal data

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tl: <T = unknown>(key: string) => T;
  /** Pick the localized column of a database row, e.g. pick(service, "name") → name_es */
  pick: (row: Record<string, unknown> | null | undefined, field: string) => string;
  pickList: (row: Record<string, unknown> | null | undefined, field: string) => string[];
};

const I18nContext = createContext<Ctx | null>(null);

function lookup(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict);
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = dictionaries[locale];
    const t = (key: string, vars?: Record<string, string | number>) => {
      const v = lookup(dict, key) ?? lookup(dictionaries.en, key);
      let s = typeof v === "string" ? v : key;
      if (vars) for (const [k, val] of Object.entries(vars)) s = s.replace(`{${k}}`, String(val));
      return s;
    };
    const tl = <T,>(key: string) => (lookup(dict, key) ?? lookup(dictionaries.en, key)) as T;
    const pick = (row: Record<string, unknown> | null | undefined, field: string) =>
      String((row?.[`${field}_${locale}`] as string | undefined) || (row?.[`${field}_en`] as string | undefined) || "");
    const pickList = (row: Record<string, unknown> | null | undefined, field: string) => {
      const v = row?.[`${field}_${locale}`] ?? row?.[`${field}_en`];
      return Array.isArray(v) ? (v as string[]) : [];
    };
    return { locale, setLocale, t, tl, pick, pickList };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
