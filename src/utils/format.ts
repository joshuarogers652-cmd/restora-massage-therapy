import type { Locale } from "@/types";

export function money(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function dateTime(iso: string | Date, locale: Locale, timeZone: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" }) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone, ...opts }).format(new Date(iso));
}

export function time(iso: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** YYYY-MM-DD for "today" in the business time zone. */
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export function minutesToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
