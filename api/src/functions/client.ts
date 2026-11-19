import { z } from "zod";
import { created, HttpError, ok, readJson, register } from "../http";
import { one, q } from "../database/db";
import { requireUser } from "../middleware/auth";
import { bookingSchema, intakeSchema, profileSchema } from "../models/schemas";
import { audit } from "../services/audit";
import { cancelAppointment, createBooking, rescheduleAppointment, saveIntake, upsertClient } from "../services/booking";
import { decryptJson } from "../services/crypto";

// Who am I? Roles come from the database, not the sign-in provider.
register({
  name: "me",
  route: "me",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireUser(req);
    const client = user.clientId
      ? await one(
          `SELECT first_name, last_name, preferred_name, phone, email, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
                  email_opt_in, sms_opt_in, marketing_opt_in FROM clients WHERE id = $1`,
          [user.clientId],
        )
      : null;
    return ok({ user: { id: user.id, email: user.email, roles: user.roles, locale: user.locale, therapistId: user.therapistId }, client });
  },
});

register({
  name: "meProfile",
  route: "me/profile",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireUser(req);
    const body = profileSchema.extend({ locale: z.enum(["en", "es"]).optional() }).parse(await readJson(req));
    const id = await upsertClient(user, body);
    if (body.locale) await q("UPDATE users SET preferred_locale = $2 WHERE id = $1", [user.id, body.locale]);
    await audit(user.id, "client.profile.update", "client", id);
    return ok({ clientId: id });
  },
});

register({
  name: "mePreferences",
  route: "me/preferences",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (!user.clientId) throw new HttpError(409, "PROFILE_REQUIRED", "Please complete your profile first.");
    const body = z
      .object({ emailOptIn: z.boolean(), smsOptIn: z.boolean(), marketingOptIn: z.boolean(), locale: z.enum(["en", "es"]) })
      .parse(await readJson(req));
    await q("UPDATE clients SET email_opt_in = $2, sms_opt_in = $3, marketing_opt_in = $4, updated_at = now() WHERE id = $1", [
      user.clientId, body.emailOptIn, body.smsOptIn, body.marketingOptIn,
    ]);
    await q("UPDATE users SET preferred_locale = $2 WHERE id = $1", [user.id, body.locale]);
    await audit(user.id, "client.preferences.update", "client", user.clientId);
    return ok({ saved: true });
  },
});

// Intake: clients can read and update their own health history.
register({
  name: "meIntake",
  route: "me/intake",
  methods: ["GET", "PUT"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (req.method === "GET") {
      if (!user.clientId) return ok({ intake: null, version: 0 });
      const row = await one<{ data_enc: string; version: number; created_at: Date }>(
        "SELECT data_enc, version, created_at FROM intakes WHERE client_id = $1 ORDER BY version DESC LIMIT 1",
        [user.clientId],
      );
      if (row) await audit(user.id, "intake.read.self", "client", user.clientId);
      return ok({ intake: row ? decryptJson(row.data_enc) : null, version: row?.version ?? 0, updatedAt: row?.created_at ?? null });
    }
    if (!user.clientId) throw new HttpError(409, "PROFILE_REQUIRED", "Please complete your profile first.");
    const intake = intakeSchema.parse(await readJson(req));
    const id = await saveIntake(user.clientId, intake);
    await audit(user.id, "intake.update.self", "client", user.clientId, { intakeId: id });
    return ok({ saved: true });
  },
});

// Appointments for the signed-in client. Therapist notes are never included.
register({
  name: "meAppointments",
  route: "me/appointments",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (!user.clientId) return ok({ appointments: [] });
    const rows = await q(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, a.total_cents, a.discount_cents, a.amount_due_now_cents, a.pressure,
              a.service_id, a.therapist_id,
              COALESCE((SELECT array_agg(ae.enhancement_id) FROM appointment_enhancements ae WHERE ae.appointment_id = a.id), '{}') AS enhancement_ids,
              s.slug AS service_slug, s.name_en AS service_name_en, s.name_es AS service_name_es, d.minutes,
              t.display_name AS therapist_name,
              COALESCE((SELECT json_agg(json_build_object('name_en', e.name_en, 'name_es', e.name_es, 'price_cents', ae.price_cents))
                          FROM appointment_enhancements ae JOIN enhancements e ON e.id = ae.enhancement_id WHERE ae.appointment_id = a.id), '[]') AS enhancements,
              (SELECT p.status FROM payments p WHERE p.appointment_id = a.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
         FROM appointments a JOIN services s ON s.id = a.service_id JOIN service_durations d ON d.id = a.duration_id
         JOIN therapists t ON t.id = a.therapist_id
        WHERE a.client_id = $1 AND a.status NOT IN ('EXPIRED','RESCHEDULED')
        ORDER BY a.starts_at DESC`,
      [user.clientId],
    );
    return ok({ appointments: rows });
  },
});

register({
  name: "bookingsCreate",
  route: "bookings",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireUser(req);
    const input = bookingSchema.parse(await readJson(req));
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
    return created(await createBooking(user, input, ip));
  },
});

register({
  name: "meAppointmentCancel",
  route: "me/appointments/{id}/cancel",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireUser(req);
    const body = await readJson<{ reason?: string }>(req);
    return ok(await cancelAppointment({ appointmentId: req.params.id!, actor: user, byBusiness: false, reason: body.reason || "Cancelled by client", refund: true }));
  },
});

register({
  name: "meAppointmentReschedule",
  route: "me/appointments/{id}/reschedule",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireUser(req);
    const body = z.object({ startsAt: z.string().datetime({ offset: true }), therapistId: z.string().uuid().nullable().default(null) }).parse(await readJson(req));
    return ok(await rescheduleAppointment({ appointmentId: req.params.id!, actor: user, startsAt: body.startsAt, therapistId: body.therapistId, byBusiness: false }));
  },
});

register({
  name: "meReceipts",
  route: "me/receipts",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (!user.clientId) return ok({ payments: [] });
    const rows = await q(
      `SELECT p.id, p.kind, p.status, p.amount_cents, p.refunded_cents, p.receipt_url, p.created_at, a.starts_at, s.name_en, s.name_es
         FROM payments p LEFT JOIN appointments a ON a.id = p.appointment_id LEFT JOIN services s ON s.id = a.service_id
        WHERE p.client_id = $1 ORDER BY p.created_at DESC`,
      [user.clientId],
    );
    return ok({ payments: rows });
  },
});

register({
  name: "meConsents",
  route: "me/consents",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (!user.clientId) return ok({ signatures: [] });
    const rows = await q(
      `SELECT cs.id, cs.signed_name, cs.signed_at, cf.kind, cf.version, cf.title_en, cf.title_es, cf.body_en, cf.body_es
         FROM consent_signatures cs JOIN consent_forms cf ON cf.id = cs.consent_form_id
        WHERE cs.client_id = $1 ORDER BY cs.signed_at DESC`,
      [user.clientId],
    );
    return ok({ signatures: rows });
  },
});

// Clients ask for a copy of their records; the owner fulfils it (see docs/ADMIN_GUIDE.md).
register({
  name: "meRecordsRequests",
  route: "me/records-requests",
  methods: ["GET", "POST"],
  handler: async (req) => {
    const user = await requireUser(req);
    if (!user.clientId) {
      if (req.method === "GET") return ok({ requests: [] });
      throw new HttpError(409, "PROFILE_REQUIRED", "Please complete your profile first.");
    }
    if (req.method === "GET") {
      return ok({
        requests: await q("SELECT id, details, created_at, fulfilled_at FROM records_requests WHERE client_id = $1 ORDER BY created_at DESC", [user.clientId]),
      });
    }
    const body = z.object({ details: z.string().trim().min(5).max(2000) }).parse(await readJson(req));
    const row = await one<{ id: string }>("INSERT INTO records_requests (client_id, details) VALUES ($1, $2) RETURNING id", [user.clientId, body.details]);
    await audit(user.id, "records_request.create", "client", user.clientId, { requestId: row!.id });
    return created({ id: row!.id });
  },
});
