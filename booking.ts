import { DateTime } from "luxon";
import type { PoolClient } from "pg";
import type { z } from "zod";
import { one, q, tx } from "../database/db";
import { HttpError } from "../errors";
import type { CurrentUser } from "../middleware/auth";
import { bookingSchema, Intake } from "../models/schemas";
import { audit } from "./audit";
import { computeFlags, evaluateSelection, loadCatalog } from "./catalog";
import { decryptJson, encryptJson } from "./crypto";
import { findSlots, localDate } from "./availability";
import { notifyAppointment } from "./notify";
import { createPaymentIntent, refundAppointment, stripeConfigured } from "./payments";
import { getSetting } from "./settings";

type BookingInput = z.infer<typeof bookingSchema>;

/** Create or update the client record that belongs to a signed-in user. */
export async function upsertClient(user: CurrentUser, profile: BookingInput["profile"], client?: PoolClient) {
  const row = await one<{ id: string }>(
    `INSERT INTO clients (user_id, first_name, last_name, preferred_name, phone, email, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
       preferred_name = EXCLUDED.preferred_name, phone = EXCLUDED.phone,
       email = COALESCE(clients.email, EXCLUDED.email), date_of_birth = COALESCE(EXCLUDED.date_of_birth, clients.date_of_birth),
       updated_at = now()
     RETURNING id`,
    [user.id, profile.firstName, profile.lastName, profile.preferredName, profile.phone, user.email, profile.dateOfBirth ?? null],
    client,
  );
  return row!.id;
}

/** Save a new intake version only when the answers changed. Returns the intake id. */
export async function saveIntake(clientId: string, intake: Intake, client?: PoolClient) {
  const latest = await one<{ id: string; version: number; data_enc: string }>(
    "SELECT id, version, data_enc FROM intakes WHERE client_id = $1 ORDER BY version DESC LIMIT 1",
    [clientId],
    client,
  );
  if (latest && JSON.stringify(decryptJson(latest.data_enc)) === JSON.stringify(intake)) return latest.id;
  const row = await one<{ id: string }>(
    "INSERT INTO intakes (client_id, version, data_enc) VALUES ($1, $2, $3) RETURNING id",
    [clientId, (latest?.version ?? 0) + 1, encryptJson(intake)],
    client,
  );
  return row!.id;
}

export function reportedConditions(intake: Intake) {
  const set = new Set(intake.conditions);
  if (intake.pregnant) set.add("pregnancy");
  if (intake.allergies.trim() || intake.skinSensitivities.trim()) set.add("allergies");
  return [...set];
}

async function applyPromotion(code: string | null, subtotal: number, c: PoolClient) {
  if (!code) return { promotionId: null as string | null, discount: 0 };
  const promo = await one<{ id: string; discount_type: string; discount_value: number; max_redemptions: number | null; redemptions: number }>(
    `SELECT id, discount_type, discount_value, max_redemptions, redemptions FROM promotions
      WHERE upper(code) = upper($1) AND active AND current_date BETWEEN starts_on AND ends_on FOR UPDATE`,
    [code],
    c,
  );
  if (!promo || (promo.max_redemptions !== null && promo.redemptions >= promo.max_redemptions)) {
    throw new HttpError(400, "PROMO_INVALID", "That promotion code isn't valid.");
  }
  const discount =
    promo.discount_type === "PERCENT" ? Math.round((subtotal * promo.discount_value) / 100) : Math.min(subtotal, promo.discount_value);
  await q("UPDATE promotions SET redemptions = redemptions + 1 WHERE id = $1", [promo.id], c);
  return { promotionId: promo.id, discount };
}

function translateDbError(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code === "23P01" || code === "40001") {
    throw new HttpError(409, "SLOT_TAKEN", "That time was just booked by someone else. Please choose another time.");
  }
  throw err;
}

export async function createBooking(user: CurrentUser, input: BookingInput, ip: string | null) {
  const [booking, payments, business] = await Promise.all([getSetting("booking"), getSetting("payments"), getSetting("business")]);
  if (!booking.onlineBookingEnabled) throw new HttpError(403, "BOOKING_DISABLED", "Online booking is turned off right now. Please contact us.");

  const catalog = await loadCatalog();
  const service = catalog.services.find((s) => s.id === input.serviceId);
  if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND");
  const sel = evaluateSelection(catalog, service, input.minutes, input.enhancementIds);
  if (!sel.ok) throw new HttpError(400, "SELECTION_INVALID", "This combination can't be booked.", sel.problems);
  if (!service.pressure_options.includes(input.concerns.pressure)) {
    throw new HttpError(400, "PRESSURE_NOT_OFFERED", "That pressure isn't offered for this service.");
  }

  // Every required consent must be signed now.
  const forms = await q<{ id: string; kind: string }>("SELECT id, kind FROM consent_forms WHERE active AND kind = ANY($1)", [sel.requiredConsents]);
  const missing = sel.requiredConsents.filter((k) => !input.consents.some((c) => c.kind === k));
  if (missing.length) throw new HttpError(400, "CONSENT_REQUIRED", "Please review and sign the required consent forms.", { missing });

  const paymentMode = payments.mode;
  if (paymentMode !== "none" && !stripeConfigured()) {
    throw new HttpError(503, "PAYMENTS_NOT_CONFIGURED", "Online payment is required but isn't set up yet. Please contact us to book.");
  }

  // The requested time must be an available slot right now (server-side check).
  const date = localDate(input.startsAt, business.timezone);
  const slots = await findSlots({
    date,
    serviceId: service.id,
    totalMinutes: sel.totalMinutes,
    qualificationEnhancementIds: sel.qualificationRequired,
    therapistId: input.therapistId,
  });
  const startIso = DateTime.fromISO(input.startsAt).toUTC().toISO()!;
  const slot = slots.find((s) => s.start === startIso);
  if (!slot) throw new HttpError(409, "SLOT_UNAVAILABLE", "That time is no longer available. Please choose another time.");

  // Same-day bookings for brand-new clients can be blocked by policy.
  if (!booking.newClientSameDayAllowed && date === DateTime.now().setZone(business.timezone).toISODate()) {
    const past = user.clientId
      ? await one<{ n: number }>("SELECT count(*)::int AS n FROM appointments WHERE client_id = $1 AND status = 'COMPLETED'", [user.clientId])
      : { n: 0 };
    if (!past || past.n === 0) throw new HttpError(409, "NEW_CLIENT_SAME_DAY", "First visits can't be booked for today. Please choose a later date.");
  }

  const flags = computeFlags(service, sel.enhancements, reportedConditions(input.intake));
  const starts = DateTime.fromISO(startIso);
  const ends = starts.plus({ minutes: sel.totalMinutes });
  const blockEnds = ends.plus({ minutes: booking.bufferMinutes });

  const result = await tx(
    async (c) => {
      // Expired checkout holds stop blocking the calendar.
      await q("UPDATE appointments SET status = 'EXPIRED', updated_at = now() WHERE status = 'HELD' AND hold_expires_at < now()", [], c);

      const clientId = await upsertClient(user, input.profile, c);
      const intakeId = await saveIntake(clientId, input.intake, c);
      await q("UPDATE users SET preferred_locale = $2 WHERE id = $1", [user.id, input.locale], c);

      const { promotionId, discount } = await applyPromotion(input.promotionCode ?? null, sel.subtotalCents, c);
      const total = Math.max(0, sel.subtotalCents - discount);
      const dueNow = paymentMode === "full" ? total : paymentMode === "deposit" ? Math.round((total * payments.depositPercent) / 100) : 0;
      const status = dueNow > 0 ? "HELD" : flags.length ? "PENDING_REVIEW" : "CONFIRMED";

      // Pick the requested therapist, or the first available one.
      const therapistId = input.therapistId ?? slot.therapistIds[0]!;
      let appt: { id: string } | undefined;
      try {
        appt = await one<{ id: string }>(
          `INSERT INTO appointments (client_id, therapist_id, service_id, duration_id, starts_at, ends_at, block_ends_at, status,
             hold_expires_at, pressure, subtotal_cents, discount_cents, total_cents, amount_due_now_cents, promotion_id, flagged_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
          [
            clientId, therapistId, service.id, sel.duration!.id, starts.toJSDate(), ends.toJSDate(), blockEnds.toJSDate(), status,
            dueNow > 0 ? DateTime.now().plus({ minutes: payments.holdMinutes }).toJSDate() : null,
            input.concerns.pressure, sel.subtotalCents, discount, total, dueNow, promotionId, flags.length,
          ],
          c,
        );
      } catch (err) {
        translateDbError(err);
      }
      const id = appt!.id;
      for (const e of sel.enhancements) {
        await q("INSERT INTO appointment_enhancements (appointment_id, enhancement_id, price_cents, added_minutes) VALUES ($1,$2,$3,$4)", [
          id, e.id, e.price_cents, e.added_minutes,
        ], c);
      }
      await q("INSERT INTO appointment_intakes (appointment_id, intake_id, concerns_enc, flags_enc) VALUES ($1,$2,$3,$4)", [
        id, intakeId, encryptJson(input.concerns), encryptJson(flags),
      ], c);
      for (const kind of sel.requiredConsents) {
        const form = forms.find((f) => f.kind === kind);
        const sig = input.consents.find((x) => x.kind === kind)!;
        if (!form) throw new HttpError(500, "CONSENT_FORM_MISSING", `No active consent form for ${kind}.`);
        await q("INSERT INTO consent_signatures (client_id, consent_form_id, appointment_id, signed_name, ip_address) VALUES ($1,$2,$3,$4,$5)", [
          clientId, form.id, id, sig.signedName, ip,
        ], c);
      }
      let payment = null;
      if (dueNow > 0) {
        payment = await createPaymentIntent({ appointmentId: id, clientId, amountCents: dueNow, kind: paymentMode === "full" ? "FULL" : "DEPOSIT", email: user.email }, c);
      }
      await audit(user.id, "appointment.create", "appointment", id, { status, flagged: flags.length }, c);
      return { id, status, total, dueNow, discount, therapistId, payment };
    },
    { serializable: true },
  ).catch(translateDbError);

  if (result.status === "CONFIRMED") await notifyAppointment(result.id, "booked_confirmed");
  if (result.status === "PENDING_REVIEW") await notifyAppointment(result.id, "booked_pending_review");

  return {
    appointmentId: result.id,
    status: result.status,
    startsAt: startIso,
    endsAt: ends.toUTC().toISO(),
    therapistId: result.therapistId,
    subtotalCents: sel.subtotalCents,
    discountCents: result.discount,
    totalCents: result.total,
    amountDueNowCents: result.dueNow,
    needsReview: flags.length > 0,
    payment: result.payment,
  };
}

const CANCELLABLE = ["HELD", "PENDING_REVIEW", "CONFIRMED"];

export async function cancelAppointment(opts: {
  appointmentId: string;
  actor: CurrentUser;
  byBusiness: boolean;
  reason: string;
  refund: boolean;
}) {
  const appt = await one<{ id: string; client_id: string; status: string; starts_at: Date }>(
    "SELECT id, client_id, status, starts_at FROM appointments WHERE id = $1",
    [opts.appointmentId],
  );
  if (!appt) throw new HttpError(404, "NOT_FOUND");
  if (!opts.byBusiness && appt.client_id !== opts.actor.clientId) throw new HttpError(404, "NOT_FOUND");
  if (!CANCELLABLE.includes(appt.status)) throw new HttpError(409, "NOT_CANCELLABLE", "This appointment can't be cancelled.");
  if (!opts.byBusiness) {
    const booking = await getSetting("booking");
    const cutoff = DateTime.fromJSDate(appt.starts_at).minus({ hours: booking.cancellationWindowHours });
    if (DateTime.now() > cutoff) {
      throw new HttpError(409, "CANCEL_WINDOW_PASSED", `Online cancellation closes ${booking.cancellationWindowHours} hours before your appointment. Please contact us.`, {
        hours: booking.cancellationWindowHours,
      });
    }
  }
  await q(
    "UPDATE appointments SET status = $2, cancelled_at = now(), cancelled_by = $3, cancel_reason = $4, updated_at = now() WHERE id = $1",
    [appt.id, opts.byBusiness ? "CANCELLED_BY_BUSINESS" : "CANCELLED_BY_CLIENT", opts.actor.id, opts.reason.slice(0, 500)],
  );
  await audit(opts.actor.id, "appointment.cancel", "appointment", appt.id, { byBusiness: opts.byBusiness });
  const refunds = opts.refund ? await refundAppointment(appt.id, opts.reason, opts.actor.id) : [];
  await notifyAppointment(appt.id, "cancelled");
  return { status: opts.byBusiness ? "CANCELLED_BY_BUSINESS" : "CANCELLED_BY_CLIENT", refunds };
}

export async function rescheduleAppointment(opts: { appointmentId: string; actor: CurrentUser; startsAt: string; therapistId: string | null; byBusiness: boolean }) {
  const appt = await one<{
    id: string; client_id: string; therapist_id: string; service_id: string; duration_id: string; status: string; starts_at: Date;
    ends_at: Date; pressure: string | null; subtotal_cents: number; discount_cents: number; total_cents: number; amount_due_now_cents: number;
    promotion_id: string | null; flagged_count: number;
  }>("SELECT * FROM appointments WHERE id = $1", [opts.appointmentId]);
  if (!appt) throw new HttpError(404, "NOT_FOUND");
  if (!opts.byBusiness && appt.client_id !== opts.actor.clientId) throw new HttpError(404, "NOT_FOUND");
  if (!["PENDING_REVIEW", "CONFIRMED"].includes(appt.status)) throw new HttpError(409, "NOT_RESCHEDULABLE", "This appointment can't be rescheduled.");
  const [booking, business] = await Promise.all([getSetting("booking"), getSetting("business")]);
  if (!opts.byBusiness && DateTime.now() > DateTime.fromJSDate(appt.starts_at).minus({ hours: booking.rescheduleWindowHours })) {
    throw new HttpError(409, "RESCHEDULE_WINDOW_PASSED", `Online rescheduling closes ${booking.rescheduleWindowHours} hours before your appointment. Please contact us.`, {
      hours: booking.rescheduleWindowHours,
    });
  }
  const enh = await q<{ enhancement_id: string; price_cents: number; added_minutes: number; requires_qualification: boolean }>(
    `SELECT ae.enhancement_id, ae.price_cents, ae.added_minutes, e.requires_qualification
       FROM appointment_enhancements ae JOIN enhancements e ON e.id = ae.enhancement_id WHERE ae.appointment_id = $1`,
    [appt.id],
  );
  const totalMinutes = Math.round((appt.ends_at.getTime() - appt.starts_at.getTime()) / 60000);
  const slots = await findSlots({
    date: localDate(opts.startsAt, business.timezone),
    serviceId: appt.service_id,
    totalMinutes,
    qualificationEnhancementIds: enh.filter((e) => e.requires_qualification).map((e) => e.enhancement_id),
    therapistId: opts.therapistId ?? appt.therapist_id,
    excludeAppointmentId: appt.id,
  });
  const startIso = DateTime.fromISO(opts.startsAt).toUTC().toISO()!;
  const slot = slots.find((s) => s.start === startIso);
  if (!slot) throw new HttpError(409, "SLOT_UNAVAILABLE", "That time is no longer available. Please choose another time.");
  const starts = DateTime.fromISO(startIso);
  const ends = starts.plus({ minutes: totalMinutes });

  const newId = await tx(
    async (c) => {
      await q("UPDATE appointments SET status = 'RESCHEDULED', updated_at = now() WHERE id = $1", [appt.id], c);
      let row: { id: string } | undefined;
      try {
        row = await one<{ id: string }>(
          `INSERT INTO appointments (client_id, therapist_id, service_id, duration_id, starts_at, ends_at, block_ends_at, status, pressure,
             subtotal_cents, discount_cents, total_cents, amount_due_now_cents, promotion_id, flagged_count, rescheduled_from)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
          [
            appt.client_id, slot.therapistIds.includes(opts.therapistId ?? appt.therapist_id) ? (opts.therapistId ?? appt.therapist_id) : slot.therapistIds[0],
            appt.service_id, appt.duration_id, starts.toJSDate(), ends.toJSDate(), ends.plus({ minutes: booking.bufferMinutes }).toJSDate(),
            appt.status, appt.pressure, appt.subtotal_cents, appt.discount_cents, appt.total_cents, appt.amount_due_now_cents,
            appt.promotion_id, appt.flagged_count, appt.id,
          ],
          c,
        );
      } catch (err) {
        translateDbError(err);
      }
      const id = row!.id;
      for (const e of enh) {
        await q("INSERT INTO appointment_enhancements (appointment_id, enhancement_id, price_cents, added_minutes) VALUES ($1,$2,$3,$4)", [
          id, e.enhancement_id, e.price_cents, e.added_minutes,
        ], c);
      }
      await q(
        "INSERT INTO appointment_intakes (appointment_id, intake_id, concerns_enc, flags_enc) SELECT $2, intake_id, concerns_enc, flags_enc FROM appointment_intakes WHERE appointment_id = $1",
        [appt.id, id],
        c,
      );
      await q(
        "INSERT INTO contraindication_reviews (appointment_id, reviewer_id, decision, rationale_enc, created_at) SELECT $2, reviewer_id, decision, rationale_enc, created_at FROM contraindication_reviews WHERE appointment_id = $1",
        [appt.id, id],
        c,
      );
      await q("UPDATE payments SET appointment_id = $2, updated_at = now() WHERE appointment_id = $1", [appt.id, id], c);
      await q("UPDATE consent_signatures SET appointment_id = $2 WHERE appointment_id = $1", [appt.id, id], c);
      await audit(opts.actor.id, "appointment.reschedule", "appointment", id, { from: appt.id }, c);
      return id;
    },
    { serializable: true },
  ).catch(translateDbError);
  await notifyAppointment(newId, "rescheduled");
  return { appointmentId: newId, startsAt: startIso, status: appt.status };
}
