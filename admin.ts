import { DateTime } from "luxon";
import { z } from "zod";
import { created, HttpError, ok, readJson, register } from "../http";
import { one, q, tx } from "../database/db";
import { requireRole } from "../middleware/auth";
import { audit } from "../services/audit";
import { cancelAppointment, rescheduleAppointment } from "../services/booking";
import { loadCatalog } from "../services/catalog";
import { randomCode, sha256 } from "../services/crypto";
import { refundPayment, stripeConfigured } from "../services/payments";
import { getAllSettings, getSetting, saveSetting, SETTINGS_KEYS, SettingsKey } from "../services/settings";

const STAFF = ["office_manager"] as const; // admin is always allowed

// ─────────────── Overview ───────────────
register({
  name: "adminOverview",
  route: "admin/overview",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, ...STAFF);
    const tz = (await getSetting("business")).timezone;
    const now = DateTime.now().setZone(tz);
    const r = await one(
      `SELECT
        (SELECT count(*)::int FROM appointments WHERE starts_at >= $1 AND starts_at < $2 AND status IN ('PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED')) AS today,
        (SELECT count(*)::int FROM appointments WHERE starts_at >= $3 AND starts_at < $4 AND status IN ('PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED')) AS week,
        (SELECT count(*)::int FROM appointments WHERE starts_at >= $5 AND starts_at < $6 AND status IN ('PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED')) AS month,
        (SELECT count(*)::int FROM appointments WHERE status = 'COMPLETED' AND starts_at >= $5 AND starts_at < $6) AS completed_month,
        (SELECT count(*)::int FROM appointments WHERE status IN ('CANCELLED_BY_CLIENT','CANCELLED_BY_BUSINESS') AND cancelled_at >= now() - interval '30 days') AS cancellations_30d,
        (SELECT count(*)::int FROM appointments WHERE status = 'NO_SHOW' AND starts_at >= now() - interval '30 days') AS no_shows_30d,
        (SELECT count(*)::int FROM appointments WHERE status = 'PENDING_REVIEW') AS pending_reviews,
        (SELECT count(*)::int FROM appointments a WHERE a.status = 'COMPLETED' AND NOT EXISTS (SELECT 1 FROM soap_notes n WHERE n.appointment_id = a.id AND n.status = 'SIGNED')) AS soap_outstanding,
        (SELECT count(*)::int FROM appointments a WHERE a.status = 'COMPLETED' AND EXISTS (SELECT 1 FROM soap_notes n WHERE n.appointment_id = a.id AND n.status = 'SIGNED')) AS soap_signed,
        (SELECT COALESCE(sum(amount_cents - refunded_cents), 0)::int FROM payments WHERE status IN ('SUCCEEDED','PARTIALLY_REFUNDED') AND created_at >= $5) AS revenue_month_cents,
        (SELECT COALESCE(sum(amount_cents), 0)::int FROM payments WHERE status IN ('REQUIRES_PAYMENT','PROCESSING')) AS outstanding_cents,
        (SELECT count(*)::int FROM clients WHERE created_at >= now() - interval '30 days') AS new_clients_30d,
        (SELECT count(DISTINCT client_id)::int FROM appointments WHERE starts_at >= now() - interval '30 days' AND client_id IN
            (SELECT client_id FROM appointments GROUP BY client_id HAVING count(*) > 1)) AS returning_clients_30d,
        (SELECT count(*)::int FROM contact_messages WHERE handled_at IS NULL) AS unread_messages,
        (SELECT count(*)::int FROM records_requests WHERE fulfilled_at IS NULL) AS open_records_requests,
        (SELECT count(*)::int FROM refunds WHERE status = 'NEEDS_MANUAL') AS manual_refunds`,
      [
        now.startOf("day").toJSDate(), now.endOf("day").toJSDate(),
        now.startOf("week").toJSDate(), now.endOf("week").toJSDate(),
        now.startOf("month").toJSDate(), now.endOf("month").toJSDate(),
      ],
    );
    const utilization = await q(
      `SELECT t.id, t.display_name,
              COALESCE((SELECT sum(end_minute - start_minute) FROM therapist_hours h WHERE h.therapist_id = t.id), 0)::int AS weekly_minutes,
              COALESCE((SELECT sum(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 60) FROM appointments a
                         WHERE a.therapist_id = t.id AND a.starts_at >= $1 AND a.starts_at < $2
                           AND a.status IN ('PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED')), 0)::int AS booked_minutes
         FROM therapists t WHERE t.active ORDER BY t.display_name`,
      [now.startOf("week").toJSDate(), now.endOf("week").toJSDate()],
    );
    return ok({ ...r, utilization, integrations: { payments: stripeConfigured() } });
  },
});

// ─────────────── Appointments ───────────────
register({
  name: "adminAppointments",
  route: "admin/appointments",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, ...STAFF);
    const from = req.query.get("from") ?? DateTime.now().startOf("day").toISO()!;
    const to = req.query.get("to") ?? DateTime.fromISO(from).plus({ days: 7 }).toISO()!;
    const status = req.query.get("status");
    const rows = await q(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, a.total_cents, a.flagged_count, a.cancel_reason,
              c.id AS client_id, c.first_name, c.last_name, c.phone, c.email,
              t.id AS therapist_id, t.display_name AS therapist_name, s.name_en AS service_name, d.minutes,
              (SELECT p.status FROM payments p WHERE p.appointment_id = a.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status,
              (SELECT n.status FROM soap_notes n WHERE n.appointment_id = a.id) AS soap_status
         FROM appointments a JOIN clients c ON c.id = a.client_id JOIN therapists t ON t.id = a.therapist_id
         JOIN services s ON s.id = a.service_id JOIN service_durations d ON d.id = a.duration_id
        WHERE a.starts_at >= $1 AND a.starts_at < $2 AND ($3::text IS NULL OR a.status = $3) AND a.status NOT IN ('EXPIRED')
        ORDER BY a.starts_at`,
      [from, to, status || null],
    );
    return ok({ appointments: rows });
  },
});

register({
  name: "adminAppointmentCancel",
  route: "admin/appointments/{id}/cancel",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireRole(req, ...STAFF);
    const body = z.object({ reason: z.string().trim().min(3).max(500), refund: z.boolean().default(true) }).parse(await readJson(req));
    return ok(await cancelAppointment({ appointmentId: req.params.id!, actor: user, byBusiness: true, reason: body.reason, refund: body.refund }));
  },
});

register({
  name: "adminAppointmentReschedule",
  route: "admin/appointments/{id}/reschedule",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireRole(req, ...STAFF);
    const body = z.object({ startsAt: z.string().datetime({ offset: true }), therapistId: z.string().uuid().nullable().default(null) }).parse(await readJson(req));
    return ok(await rescheduleAppointment({ appointmentId: req.params.id!, actor: user, startsAt: body.startsAt, therapistId: body.therapistId, byBusiness: true }));
  },
});

// ─────────────── Clients (contact & appointment info only; no clinical content) ───────────────
register({
  name: "adminClients",
  route: "admin/clients",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireRole(req, ...STAFF);
    const search = (req.query.get("q") ?? "").trim();
    const rows = await q(
      `SELECT c.id, c.first_name, c.last_name, c.preferred_name, c.email, c.phone, c.created_at, c.email_opt_in, c.sms_opt_in,
              (SELECT count(*)::int FROM appointments a WHERE a.client_id = c.id AND a.status = 'COMPLETED') AS visits,
              (SELECT count(*)::int FROM appointments a WHERE a.client_id = c.id AND a.status = 'NO_SHOW') AS no_shows,
              (SELECT max(a.starts_at) FROM appointments a WHERE a.client_id = c.id AND a.status = 'COMPLETED') AS last_visit
         FROM clients c
        WHERE $1 = '' OR (c.first_name || ' ' || c.last_name || ' ' || COALESCE(c.email,'') || ' ' || COALESCE(c.phone,'')) ILIKE '%' || $1 || '%'
        ORDER BY c.last_name, c.first_name LIMIT 200`,
      [search],
    );
    await audit(user.id, "clients.list", "client", null, { search: search ? "yes" : "no" });
    return ok({ clients: rows });
  },
});

// ─────────────── Services & pricing (admin only) ───────────────
register({
  name: "adminServices",
  route: "admin/services",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "office_manager");
    const catalog = await loadCatalog({ includeInactive: true });
    return ok(catalog);
  },
});

const textList = z.array(z.string().trim().min(1).max(500)).max(12);
const serviceUpdate = z.object({
  name_en: z.string().trim().min(2).max(120),
  name_es: z.string().trim().min(2).max(120),
  summary_en: z.string().trim().min(5).max(400),
  summary_es: z.string().trim().min(5).max(400),
  description_en: z.string().trim().min(5).max(3000),
  description_es: z.string().trim().min(5).max(3000),
  benefits_en: textList,
  benefits_es: textList,
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
  durations: z
    .array(z.object({ minutes: z.number().int().min(15).max(240), price_cents: z.number().int().min(0).max(1_000_000).nullable(), active: z.boolean() }))
    .min(1)
    .max(8),
});

register({
  name: "adminServiceUpdate",
  route: "admin/services/{id}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const body = serviceUpdate.parse(await readJson(req));
    await tx(async (c) => {
      const res = await c.query(
        `UPDATE services SET name_en=$2, name_es=$3, summary_en=$4, summary_es=$5, description_en=$6, description_es=$7,
           benefits_en=$8, benefits_es=$9, active=$10, sort_order=$11, updated_at=now() WHERE id=$1`,
        [req.params.id, body.name_en, body.name_es, body.summary_en, body.summary_es, body.description_en, body.description_es,
         JSON.stringify(body.benefits_en), JSON.stringify(body.benefits_es), body.active, body.sort_order],
      );
      if (!res.rowCount) throw new HttpError(404, "NOT_FOUND");
      for (const d of body.durations) {
        await q(
          `INSERT INTO service_durations (service_id, minutes, price_cents, active) VALUES ($1,$2,$3,$4)
           ON CONFLICT (service_id, minutes) DO UPDATE SET price_cents = EXCLUDED.price_cents, active = EXCLUDED.active`,
          [req.params.id, d.minutes, d.price_cents, d.active],
          c,
        );
      }
      await q("UPDATE service_durations SET active = false WHERE service_id = $1 AND NOT (minutes = ANY($2))", [req.params.id, body.durations.map((d) => d.minutes)], c);
      await audit(user.id, "service.update", "service", req.params.id!, { durations: body.durations }, c);
    });
    return ok({ saved: true });
  },
});

const enhancementUpdate = z.object({
  name_en: z.string().trim().min(2).max(120),
  name_es: z.string().trim().min(2).max(120),
  description_en: z.string().trim().min(5).max(2000),
  description_es: z.string().trim().min(5).max(2000),
  benefits_en: textList,
  benefits_es: textList,
  added_minutes: z.number().int().min(0).max(120).nullable(),
  price_cents: z.number().int().min(0).max(1_000_000).nullable(),
  active: z.boolean(),
});

register({
  name: "adminEnhancementUpdate",
  route: "admin/enhancements/{id}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const b = enhancementUpdate.parse(await readJson(req));
    const res = await q(
      `UPDATE enhancements SET name_en=$2, name_es=$3, description_en=$4, description_es=$5, benefits_en=$6, benefits_es=$7,
         added_minutes=$8, price_cents=$9, active=$10, updated_at=now() WHERE id=$1 RETURNING id`,
      [req.params.id, b.name_en, b.name_es, b.description_en, b.description_es, JSON.stringify(b.benefits_en), JSON.stringify(b.benefits_es),
       b.added_minutes, b.price_cents, b.active],
    );
    if (!res.length) throw new HttpError(404, "NOT_FOUND");
    await audit(user.id, "enhancement.update", "enhancement", req.params.id!, { price_cents: b.price_cents, added_minutes: b.added_minutes, active: b.active });
    return ok({ saved: true });
  },
});

// ─────────────── Therapists ───────────────
register({
  name: "adminTherapists",
  route: "admin/therapists",
  methods: ["GET", "POST"],
  handler: async (req) => {
    if (req.method === "GET") {
      await requireRole(req, ...STAFF);
      const rows = await q(
        `SELECT t.*, u.email AS user_email, to_char(t.license_expires_on, 'YYYY-MM-DD') AS license_expires_on,
                COALESCE((SELECT array_agg(service_id) FROM therapist_services WHERE therapist_id = t.id), '{}') AS service_ids,
                COALESCE((SELECT json_agg(json_build_object('enhancement_id', enhancement_id, 'certification', certification))
                           FROM therapist_enhancements WHERE therapist_id = t.id), '[]') AS enhancements,
                COALESCE((SELECT json_agg(json_build_object('weekday', weekday, 'start_minute', start_minute, 'end_minute', end_minute) ORDER BY weekday, start_minute)
                           FROM therapist_hours WHERE therapist_id = t.id), '[]') AS hours
           FROM therapists t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.display_name`,
      );
      return ok({ therapists: rows });
    }
    const user = await requireRole(req, "admin");
    const body = therapistBody.parse(await readJson(req));
    const id = await tx(async (c) => {
      const row = await one<{ id: string }>(
        `INSERT INTO therapists (invite_email, display_name, bio_en, bio_es, license_number, license_expires_on, active, accepts_new_clients)
         VALUES (lower($1),$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [body.inviteEmail, body.displayName, body.bio_en, body.bio_es, body.licenseNumber, body.licenseExpiresOn, body.active, body.acceptsNewClients],
        c,
      );
      // If the person has already signed in once, link them now.
      const existing = await one<{ id: string }>("SELECT id FROM users WHERE lower(email) = lower($1)", [body.inviteEmail], c);
      if (existing) {
        await q("UPDATE therapists SET user_id = $2 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM therapists WHERE user_id = $2)", [row!.id, existing.id], c);
        await q("INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, 'therapist', $2) ON CONFLICT DO NOTHING", [existing.id, user.id], c);
      }
      await saveTherapistLinks(row!.id, body, c);
      await audit(user.id, "therapist.create", "therapist", row!.id, undefined, c);
      return row!.id;
    });
    return created({ id });
  },
});

const therapistBody = z.object({
  inviteEmail: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(120),
  bio_en: z.string().trim().max(2000).nullable().default(null),
  bio_es: z.string().trim().max(2000).nullable().default(null),
  licenseNumber: z.string().trim().max(60).nullable().default(null),
  licenseExpiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  active: z.boolean().default(true),
  acceptsNewClients: z.boolean().default(true),
  serviceIds: z.array(z.string().uuid()).default([]),
  enhancements: z.array(z.object({ enhancementId: z.string().uuid(), certification: z.string().trim().max(200).nullable().default(null) })).default([]),
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) }))
    .max(30)
    .default([]),
});

async function saveTherapistLinks(id: string, body: z.infer<typeof therapistBody>, c: import("pg").PoolClient) {
  for (const h of body.hours) if (h.endMinute <= h.startMinute) throw new HttpError(400, "BAD_HOURS", "Each work period must end after it starts.");
  await q("DELETE FROM therapist_services WHERE therapist_id = $1", [id], c);
  for (const s of body.serviceIds) await q("INSERT INTO therapist_services (therapist_id, service_id) VALUES ($1,$2)", [id, s], c);
  await q("DELETE FROM therapist_enhancements WHERE therapist_id = $1", [id], c);
  for (const e of body.enhancements) {
    await q("INSERT INTO therapist_enhancements (therapist_id, enhancement_id, certification, verified_on) VALUES ($1,$2,$3,current_date)", [id, e.enhancementId, e.certification], c);
  }
  await q("DELETE FROM therapist_hours WHERE therapist_id = $1", [id], c);
  for (const h of body.hours) {
    await q("INSERT INTO therapist_hours (therapist_id, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)", [id, h.weekday, h.startMinute, h.endMinute], c);
  }
}

register({
  name: "adminTherapistUpdate",
  route: "admin/therapists/{id}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const body = therapistBody.parse(await readJson(req));
    await tx(async (c) => {
      const res = await c.query(
        `UPDATE therapists SET invite_email=lower($2), display_name=$3, bio_en=$4, bio_es=$5, license_number=$6, license_expires_on=$7,
           active=$8, accepts_new_clients=$9 WHERE id=$1`,
        [req.params.id, body.inviteEmail, body.displayName, body.bio_en, body.bio_es, body.licenseNumber, body.licenseExpiresOn, body.active, body.acceptsNewClients],
      );
      if (!res.rowCount) throw new HttpError(404, "NOT_FOUND");
      await saveTherapistLinks(req.params.id!, body, c);
      await audit(user.id, "therapist.update", "therapist", req.params.id!, undefined, c);
    });
    return ok({ saved: true });
  },
});

// ─────────────── Time off & closed days ───────────────
register({
  name: "adminTimeOff",
  route: "admin/time-off",
  methods: ["GET", "POST"],
  handler: async (req) => {
    if (req.method === "GET") {
      await requireRole(req, ...STAFF);
      return ok({
        timeOff: await q(
          `SELECT o.id, o.therapist_id, t.display_name, o.starts_at, o.ends_at, o.reason FROM time_off o
             LEFT JOIN therapists t ON t.id = o.therapist_id WHERE o.ends_at > now() - interval '30 days' ORDER BY o.starts_at`,
        ),
      });
    }
    const user = await requireRole(req, ...STAFF);
    const b = z
      .object({ therapistId: z.string().uuid().nullable(), startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }), reason: z.string().trim().max(200).default("") })
      .parse(await readJson(req));
    if (new Date(b.endsAt) <= new Date(b.startsAt)) throw new HttpError(400, "BAD_RANGE", "The end must be after the start.");
    const row = await one<{ id: string }>("INSERT INTO time_off (therapist_id, starts_at, ends_at, reason) VALUES ($1,$2,$3,$4) RETURNING id", [b.therapistId, b.startsAt, b.endsAt, b.reason]);
    await audit(user.id, "time_off.create", "time_off", row!.id);
    return created({ id: row!.id });
  },
});

register({
  name: "adminTimeOffDelete",
  route: "admin/time-off/{id}",
  methods: ["DELETE"],
  handler: async (req) => {
    const user = await requireRole(req, ...STAFF);
    await q("DELETE FROM time_off WHERE id = $1", [req.params.id]);
    await audit(user.id, "time_off.delete", "time_off", req.params.id!);
    return ok({ deleted: true });
  },
});

// ─────────────── Users & roles (admin only) ───────────────
register({
  name: "adminUsers",
  route: "admin/users",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "admin");
    return ok({
      users: await q(
        `SELECT u.id, u.email, u.identity_provider, u.created_at, u.last_login_at, u.disabled_at,
                COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
           FROM users u LEFT JOIN user_roles r ON r.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`,
      ),
    });
  },
});

register({
  name: "adminUserRoles",
  route: "admin/users/{id}/roles",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const { roles } = z.object({ roles: z.array(z.enum(["client", "therapist", "office_manager", "admin"])).max(4) }).parse(await readJson(req));
    if (req.params.id === user.id && !roles.includes("admin")) {
      throw new HttpError(400, "CANNOT_REMOVE_OWN_ADMIN", "You can't remove your own administrator access.");
    }
    await tx(async (c) => {
      await q("DELETE FROM user_roles WHERE user_id = $1", [req.params.id], c);
      for (const r of roles) await q("INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1,$2,$3)", [req.params.id, r, user.id], c);
      await audit(user.id, "user.roles.update", "user", req.params.id!, { roles }, c);
    });
    return ok({ roles });
  },
});

// ─────────────── Settings (admin only) ───────────────
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const settingSchemas: Record<SettingsKey, z.ZodTypeAny> = {
  business: z.object({
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().email().nullable().or(z.literal("").transform(() => null)),
    address: z.string().trim().max(300).nullable(),
    mapUrl: z.string().trim().url().startsWith("https://").nullable().or(z.literal("").transform(() => null)),
    area_en: z.string().trim().max(200),
    area_es: z.string().trim().max(200),
    timezone: z.string().trim().min(3).max(60),
    hours: z.record(z.string().regex(/^[0-6]$/), z.object({ open: hhmm, close: hhmm }).nullable()),
  }),
  booking: z.object({
    onlineBookingEnabled: z.boolean(),
    slotIntervalMinutes: z.number().int().min(5).max(120),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeHours: z.number().int().min(0).max(240),
    maxDaysAhead: z.number().int().min(1).max(365),
    cancellationWindowHours: z.number().int().min(0).max(240),
    rescheduleWindowHours: z.number().int().min(0).max(240),
    newClientSameDayAllowed: z.boolean(),
  }),
  payments: z.object({ mode: z.enum(["none", "deposit", "full"]), depositPercent: z.number().int().min(1).max(100), holdMinutes: z.number().int().min(5).max(60) }),
  content: z.object({
    announcement_en: z.string().trim().max(300),
    announcement_es: z.string().trim().max(300),
    lotion_en: z.string().trim().min(10).max(600),
    lotion_es: z.string().trim().min(10).max(600),
  }),
  notifications: z.object({ emailEnabled: z.boolean(), smsEnabled: z.boolean() }),
};

register({
  name: "adminSettings",
  route: "admin/settings",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "admin");
    return ok({ settings: await getAllSettings(), integrations: { payments: stripeConfigured() } });
  },
});

register({
  name: "adminSettingsUpdate",
  route: "admin/settings/{key}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const key = req.params.key as SettingsKey;
    if (!SETTINGS_KEYS.includes(key)) throw new HttpError(404, "NOT_FOUND");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = settingSchemas[key].parse(await readJson(req)) as any;
    if (key === "payments" && value.mode !== "none" && !stripeConfigured()) {
      throw new HttpError(409, "PAYMENTS_NOT_CONFIGURED", "Add the Stripe keys in Azure before turning on online payments (see docs/AZURE_DEPLOYMENT.md).");
    }
    if (key === "business") {
      for (const [, h] of Object.entries(value.hours as Record<string, { open: string; close: string } | null>)) {
        if (h && h.close <= h.open) throw new HttpError(400, "BAD_HOURS", "Closing time must be after opening time.");
      }
    }
    await saveSetting(key, value, user.id);
    await audit(user.id, "settings.update", "settings", key);
    return ok({ saved: true });
  },
});

// ─────────────── Promotions ───────────────
const promoBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/),
  title_en: z.string().trim().min(2).max(120),
  title_es: z.string().trim().min(2).max(120),
  discount_type: z.enum(["PERCENT", "FIXED_CENTS"]),
  discount_value: z.number().int().min(1).max(1_000_000),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  max_redemptions: z.number().int().min(1).nullable().default(null),
  active: z.boolean().default(true),
});

register({
  name: "adminPromotions",
  route: "admin/promotions",
  methods: ["GET", "POST"],
  handler: async (req) => {
    if (req.method === "GET") {
      await requireRole(req, ...STAFF);
      return ok({ promotions: await q("SELECT *, to_char(starts_on,'YYYY-MM-DD') AS starts_on, to_char(ends_on,'YYYY-MM-DD') AS ends_on FROM promotions ORDER BY created_at DESC") });
    }
    const user = await requireRole(req, "admin");
    const b = promoBody.parse(await readJson(req));
    if (b.discount_type === "PERCENT" && b.discount_value > 100) throw new HttpError(400, "BAD_PERCENT", "A percentage can't be more than 100.");
    try {
      const row = await one<{ id: string }>(
        `INSERT INTO promotions (code, title_en, title_es, discount_type, discount_value, starts_on, ends_on, max_redemptions, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [b.code, b.title_en, b.title_es, b.discount_type, b.discount_value, b.starts_on, b.ends_on, b.max_redemptions, b.active],
      );
      await audit(user.id, "promotion.create", "promotion", row!.id);
      return created({ id: row!.id });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new HttpError(409, "CODE_EXISTS", "That code already exists.");
      throw e;
    }
  },
});

register({
  name: "adminPromotionUpdate",
  route: "admin/promotions/{id}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const { active } = z.object({ active: z.boolean() }).parse(await readJson(req));
    await q("UPDATE promotions SET active = $2 WHERE id = $1", [req.params.id, active]);
    await audit(user.id, "promotion.update", "promotion", req.params.id!, { active });
    return ok({ saved: true });
  },
});

// ─────────────── Gift cards ───────────────
register({
  name: "adminGiftCards",
  route: "admin/gift-cards",
  methods: ["GET", "POST"],
  handler: async (req) => {
    if (req.method === "GET") {
      await requireRole(req, ...STAFF);
      return ok({
        giftCards: await q(
          "SELECT id, last4, initial_cents, balance_cents, recipient_name, recipient_email, to_char(expires_on,'YYYY-MM-DD') AS expires_on, created_at, disabled_at FROM gift_cards ORDER BY created_at DESC",
        ),
      });
    }
    const user = await requireRole(req, "admin");
    const b = z
      .object({
        amountCents: z.number().int().min(100).max(100_000),
        recipientName: z.string().trim().max(120).nullable().default(null),
        recipientEmail: z.string().trim().email().nullable().default(null),
        expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
      })
      .parse(await readJson(req));
    const code = randomCode();
    const row = await one<{ id: string }>(
      `INSERT INTO gift_cards (code_hash, last4, initial_cents, balance_cents, recipient_name, recipient_email, expires_on, created_by)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7) RETURNING id`,
      [sha256(code), code.slice(-4), b.amountCents, b.recipientName, b.recipientEmail, b.expiresOn, user.id],
    );
    await audit(user.id, "gift_card.create", "gift_card", row!.id, { amountCents: b.amountCents });
    // The full code is returned once and never stored in readable form.
    return created({ id: row!.id, code });
  },
});

register({
  name: "adminGiftCardUpdate",
  route: "admin/gift-cards/{id}",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const b = z.object({ balanceCents: z.number().int().min(0).max(100_000), disabled: z.boolean() }).parse(await readJson(req));
    await q("UPDATE gift_cards SET balance_cents = $2, disabled_at = CASE WHEN $3 THEN COALESCE(disabled_at, now()) ELSE NULL END WHERE id = $1", [req.params.id, b.balanceCents, b.disabled]);
    await audit(user.id, "gift_card.update", "gift_card", req.params.id!, b);
    return ok({ saved: true });
  },
});

// ─────────────── Payments, refunds & reports ───────────────
register({
  name: "adminPayments",
  route: "admin/payments",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, ...STAFF);
    return ok({
      payments: await q(
        `SELECT p.id, p.kind, p.status, p.amount_cents, p.refunded_cents, p.receipt_url, p.created_at, p.appointment_id,
                c.first_name, c.last_name, a.starts_at,
                (SELECT json_agg(json_build_object('amount_cents', r.amount_cents, 'status', r.status, 'reason', r.reason, 'created_at', r.created_at))
                   FROM refunds r WHERE r.payment_id = p.id) AS refunds
           FROM payments p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN appointments a ON a.id = p.appointment_id
          ORDER BY p.created_at DESC LIMIT 300`,
      ),
      configured: stripeConfigured(),
    });
  },
});

register({
  name: "adminRefund",
  route: "admin/payments/{id}/refund",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const b = z.object({ amountCents: z.number().int().min(1), reason: z.string().trim().min(3).max(300) }).parse(await readJson(req));
    const p = await one<{ id: string; amount_cents: number; refunded_cents: number; stripe_payment_intent_id: string | null; status: string }>(
      "SELECT id, amount_cents, refunded_cents, stripe_payment_intent_id, status FROM payments WHERE id = $1",
      [req.params.id],
    );
    if (!p) throw new HttpError(404, "NOT_FOUND");
    if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status)) throw new HttpError(409, "NOT_REFUNDABLE", "Only completed payments can be refunded.");
    const result = await refundPayment(p, b.amountCents, b.reason, user.id);
    await audit(user.id, "payment.refund", "payment", p.id, { amountCents: b.amountCents, status: result.status });
    return ok(result);
  },
});

register({
  name: "adminRevenueReport",
  route: "admin/reports/revenue",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "admin");
    const tz = (await getSetting("business")).timezone;
    const rows = await q(
      `SELECT to_char(date_trunc('month', p.created_at AT TIME ZONE $1), 'YYYY-MM') AS month,
              COALESCE(sum(p.amount_cents) FILTER (WHERE p.status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED')), 0)::int AS collected_cents,
              COALESCE(sum(p.refunded_cents), 0)::int AS refunded_cents
         FROM payments p WHERE p.created_at >= now() - interval '12 months' GROUP BY 1 ORDER BY 1`,
      [tz],
    );
    const booked = await q(
      `SELECT to_char(date_trunc('month', a.starts_at AT TIME ZONE $1), 'YYYY-MM') AS month,
              COALESCE(sum(a.total_cents) FILTER (WHERE a.status = 'COMPLETED'), 0)::int AS completed_value_cents,
              count(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed,
              count(*) FILTER (WHERE a.status IN ('CANCELLED_BY_CLIENT','CANCELLED_BY_BUSINESS'))::int AS cancelled,
              count(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_shows
         FROM appointments a WHERE a.starts_at >= now() - interval '12 months' GROUP BY 1 ORDER BY 1`,
      [tz],
    );
    return ok({ payments: rows, appointments: booked });
  },
});

// ─────────────── Messages, records requests, audit ───────────────
register({
  name: "adminMessages",
  route: "admin/messages",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, ...STAFF);
    return ok({ messages: await q("SELECT * FROM contact_messages ORDER BY handled_at NULLS FIRST, created_at DESC LIMIT 200") });
  },
});

register({
  name: "adminMessageHandled",
  route: "admin/messages/{id}/handled",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireRole(req, ...STAFF);
    await q("UPDATE contact_messages SET handled_at = now(), handled_by = $2 WHERE id = $1", [req.params.id, user.id]);
    return ok({ saved: true });
  },
});

register({
  name: "adminRecordsRequests",
  route: "admin/records-requests",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "admin");
    return ok({
      requests: await q(
        `SELECT r.id, r.details, r.created_at, r.fulfilled_at, r.notes, c.first_name, c.last_name, c.email
           FROM records_requests r JOIN clients c ON c.id = r.client_id ORDER BY r.fulfilled_at NULLS FIRST, r.created_at DESC`,
      ),
    });
  },
});

register({
  name: "adminRecordsRequestFulfil",
  route: "admin/records-requests/{id}/fulfil",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireRole(req, "admin");
    const { notes } = z.object({ notes: z.string().trim().min(3).max(1000) }).parse(await readJson(req));
    await q("UPDATE records_requests SET fulfilled_at = now(), fulfilled_by = $2, notes = $3 WHERE id = $1", [req.params.id, user.id, notes]);
    await audit(user.id, "records_request.fulfil", "records_request", req.params.id!);
    return ok({ saved: true });
  },
});

register({
  name: "adminAudit",
  route: "admin/audit",
  methods: ["GET"],
  handler: async (req) => {
    await requireRole(req, "admin");
    return ok({
      entries: await q(
        "SELECT l.id, l.action, l.entity_type, l.entity_id, l.metadata, l.created_at, u.email AS actor FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.id DESC LIMIT 300",
      ),
    });
  },
});
