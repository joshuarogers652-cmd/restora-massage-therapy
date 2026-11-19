import { DateTime } from "luxon";
import type { PoolClient } from "pg";
import { q } from "../database/db";
import { HttpError } from "../errors";
import { getSetting } from "./settings";

export const ACTIVE_STATUSES = ["HELD", "PENDING_REVIEW", "CONFIRMED", "CHECKED_IN"];

export type Slot = { start: string; therapistIds: string[] };

type Busy = { therapist_id: string | null; starts_at: Date; ends_at: Date };

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Bookable start times for one business-local date.
 * A slot is offered when a therapist qualified for the service AND every
 * enhancement that needs a qualification is working, the session fits inside
 * their hours (and the business hours, when published), and it doesn't overlap
 * another active appointment (plus cleanup buffer), time off or a closed day.
 */
export async function findSlots(
  input: {
    date: string; // YYYY-MM-DD in business time
    serviceId: string;
    totalMinutes: number;
    qualificationEnhancementIds: string[];
    therapistId?: string | null;
    excludeAppointmentId?: string | null;
    now?: Date;
  },
  client?: PoolClient,
): Promise<Slot[]> {
  const [business, booking] = await Promise.all([getSetting("business", client), getSetting("booking", client)]);
  const tz = business.timezone || "America/Chicago";
  const now = DateTime.fromJSDate(input.now ?? new Date()).setZone(tz);
  const day = DateTime.fromISO(input.date, { zone: tz });
  if (!day.isValid) throw new HttpError(400, "BAD_DATE", "Use a date like 2026-12-01.");
  if (day < now.startOf("day")) return [];
  if (day > now.startOf("day").plus({ days: booking.maxDaysAhead })) return [];

  const weekday = day.weekday % 7; // luxon: Mon=1..Sun=7 → 0=Sun
  const hoursPublished = Object.keys(business.hours ?? {}).length > 0;
  const bh = business.hours?.[String(weekday)] ?? null;
  if (hoursPublished && !bh) return []; // business closed that day

  const therapists = await q<{ id: string }>(
    `SELECT t.id FROM therapists t
       JOIN therapist_services ts ON ts.therapist_id = t.id AND ts.service_id = $1
      WHERE t.active AND t.user_id IS NOT NULL
        AND ($2::uuid IS NULL OR t.id = $2)
        AND NOT EXISTS (
          SELECT 1 FROM unnest($3::uuid[]) req(eid)
           WHERE NOT EXISTS (SELECT 1 FROM therapist_enhancements te WHERE te.therapist_id = t.id AND te.enhancement_id = req.eid))`,
    [input.serviceId, input.therapistId ?? null, input.qualificationEnhancementIds],
    client,
  );
  if (!therapists.length) return [];
  const ids = therapists.map((t) => t.id);

  const dayStart = day.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  const [hours, appts, off] = await Promise.all([
    q<{ therapist_id: string; start_minute: number; end_minute: number }>(
      "SELECT therapist_id, start_minute, end_minute FROM therapist_hours WHERE therapist_id = ANY($1) AND weekday = $2",
      [ids, weekday],
      client,
    ),
    q<Busy>(
      `SELECT therapist_id, starts_at, block_ends_at AS ends_at FROM appointments
        WHERE therapist_id = ANY($1) AND status = ANY($2)
          AND NOT (status = 'HELD' AND hold_expires_at < now())
          AND ($5::uuid IS NULL OR id <> $5)
          AND starts_at < $4 AND block_ends_at > $3`,
      [ids, ACTIVE_STATUSES, dayStart.toJSDate(), dayEnd.toJSDate(), input.excludeAppointmentId ?? null],
      client,
    ),
    q<Busy>(
      `SELECT therapist_id, starts_at, ends_at FROM time_off
        WHERE (therapist_id IS NULL OR therapist_id = ANY($1)) AND starts_at < $3 AND ends_at > $2`,
      [ids, dayStart.toJSDate(), dayEnd.toJSDate()],
      client,
    ),
  ]);

  const earliest = now.plus({ hours: booking.minNoticeHours });
  const step = Math.max(5, booking.slotIntervalMinutes);
  const buffer = Math.max(0, booking.bufferMinutes);
  const slots = new Map<string, string[]>();

  for (const tid of ids) {
    const busy = [...appts, ...off].filter((b) => b.therapist_id === tid || b.therapist_id === null);
    for (const h of hours.filter((x) => x.therapist_id === tid)) {
      let open = h.start_minute;
      let close = h.end_minute;
      if (bh) {
        open = Math.max(open, toMinutes(bh.open));
        close = Math.min(close, toMinutes(bh.close));
      }
      for (let m = open; m + input.totalMinutes <= close; m += step) {
        // Wall-clock time, so daylight-saving changes don't shift the schedule.
        const start = dayStart.set({ hour: Math.floor(m / 60), minute: m % 60 });
        if (start < earliest) continue;
        const end = start.plus({ minutes: input.totalMinutes });
        const blockEnd = end.plus({ minutes: buffer });
        const s = start.toMillis();
        const e = blockEnd.toMillis();
        if (busy.some((b) => b.starts_at.getTime() < e && b.ends_at.getTime() > s)) continue;
        const key = start.toUTC().toISO()!;
        slots.set(key, [...(slots.get(key) ?? []), tid]);
      }
    }
  }
  return [...slots.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, therapistIds]) => ({ start, therapistIds }));
}

/** Business-local calendar date for an instant. */
export function localDate(iso: string, tz: string) {
  return DateTime.fromISO(iso).setZone(tz).toISODate()!;
}
