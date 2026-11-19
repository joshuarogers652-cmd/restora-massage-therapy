import type { PoolClient } from "pg";
import { one, q } from "../database/db";

export type DayHours = { open: string; close: string } | null;

export type BusinessSettings = {
  phone: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  area_en: string;
  area_es: string;
  timezone: string;
  /** Keys "0".."6" (0 = Sunday). Empty object = hours not published yet; booking uses therapist hours only. */
  hours: Record<string, DayHours>;
};

export type BookingSettings = {
  onlineBookingEnabled: boolean;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  cancellationWindowHours: number;
  rescheduleWindowHours: number;
  newClientSameDayAllowed: boolean;
};

export type PaymentSettings = { mode: "none" | "deposit" | "full"; depositPercent: number; holdMinutes: number };
export type ContentSettings = { announcement_en: string; announcement_es: string; lotion_en: string; lotion_es: string };
export type NotificationSettings = { emailEnabled: boolean; smsEnabled: boolean };

export type SettingsMap = {
  business: BusinessSettings;
  booking: BookingSettings;
  payments: PaymentSettings;
  content: ContentSettings;
  notifications: NotificationSettings;
};
export type SettingsKey = keyof SettingsMap;
export const SETTINGS_KEYS: SettingsKey[] = ["business", "booking", "payments", "content", "notifications"];

const DEFAULTS: SettingsMap = {
  business: { phone: null, email: null, address: null, mapUrl: null, area_en: "", area_es: "", timezone: "America/Chicago", hours: {} },
  booking: {
    onlineBookingEnabled: true,
    slotIntervalMinutes: 30,
    bufferMinutes: 15,
    minNoticeHours: 12,
    maxDaysAhead: 60,
    cancellationWindowHours: 24,
    rescheduleWindowHours: 24,
    newClientSameDayAllowed: false,
  },
  payments: { mode: "none", depositPercent: 25, holdMinutes: 15 },
  content: { announcement_en: "", announcement_es: "", lotion_en: "", lotion_es: "" },
  notifications: { emailEnabled: true, smsEnabled: false },
};

export async function getSetting<K extends SettingsKey>(key: K, client?: PoolClient): Promise<SettingsMap[K]> {
  const row = await one<{ value: Partial<SettingsMap[K]> }>("SELECT value FROM settings WHERE key = $1", [key], client);
  return { ...DEFAULTS[key], ...(row?.value ?? {}) } as SettingsMap[K];
}

export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await q<{ key: SettingsKey; value: object }>("SELECT key, value FROM settings");
  const out = structuredClone(DEFAULTS);
  for (const r of rows) if (r.key in out) Object.assign(out[r.key], r.value);
  return out;
}

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsMap[K], userId: string) {
  await q(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(value), userId],
  );
}
