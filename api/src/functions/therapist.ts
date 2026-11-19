import { DateTime } from "luxon";
import { z } from "zod";
import { HttpError, ok, readJson, register } from "../http";
import { one, q, tx } from "../database/db";
import { CurrentUser, requireTherapist } from "../middleware/auth";
import { reviewSchema, soapContentSchema, SoapContent } from "../models/schemas";
import { audit } from "../services/audit";
import { decryptJson, encryptJson } from "../services/crypto";
import { notifyAppointment } from "../services/notify";
import { refundAppointment } from "../services/payments";

type ApptRow = {
  id: string;
  client_id: string;
  therapist_id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  flagged_count: number;
};

/** Therapists may only open their own appointments. Admins may open any. */
async function authorizedAppointment(user: CurrentUser, id: string): Promise<ApptRow> {
  const appt = await one<ApptRow>("SELECT id, client_id, therapist_id, status, starts_at, ends_at, flagged_count FROM appointments WHERE id = $1", [id]);
  if (!appt) throw new HttpError(404, "NOT_FOUND");
  if (appt.therapist_id !== user.therapistId && !user.roles.includes("admin")) {
    await audit(user.id, "access.denied", "appointment", id);
    throw new HttpError(404, "NOT_FOUND");
  }
  return appt;
}

register({
  name: "therapistSchedule",
  route: "therapist/schedule",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const from = req.query.get("from") ?? DateTime.now().startOf("day").toISO()!;
    const to = req.query.get("to") ?? DateTime.fromISO(from).plus({ days: 14 }).toISO()!;
    const therapistId = user.therapistId ?? req.query.get("therapistId");
    const rows = await q(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, a.flagged_count, a.pressure,
              c.first_name, c.last_name, c.preferred_name,
              s.name_en AS service_name_en, s.name_es AS service_name_es, d.minutes,
              COALESCE((SELECT json_agg(e.name_en) FROM appointment_enhancements ae JOIN enhancements e ON e.id = ae.enhancement_id
                         WHERE ae.appointment_id = a.id), '[]') AS enhancements,
              EXISTS (SELECT 1 FROM appointment_intakes ai WHERE ai.appointment_id = a.id) AS intake_complete,
              (SELECT n.status FROM soap_notes n WHERE n.appointment_id = a.id) AS soap_status,
              (SELECT r.decision FROM contraindication_reviews r WHERE r.appointment_id = a.id ORDER BY r.created_at DESC LIMIT 1) AS last_review
         FROM appointments a JOIN clients c ON c.id = a.client_id JOIN services s ON s.id = a.service_id
         JOIN service_durations d ON d.id = a.duration_id
        WHERE ($1::uuid IS NULL OR a.therapist_id = $1) AND a.starts_at >= $2 AND a.starts_at < $3
          AND a.status IN ('PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW')
        ORDER BY a.starts_at`,
      [therapistId, from, to],
    );
    const outstandingSoap = await q(
      `SELECT a.id, a.starts_at, c.first_name, c.last_name, s.name_en AS service_name_en, s.name_es AS service_name_es
         FROM appointments a JOIN clients c ON c.id = a.client_id JOIN services s ON s.id = a.service_id
        WHERE ($1::uuid IS NULL OR a.therapist_id = $1) AND a.status = 'COMPLETED'
          AND NOT EXISTS (SELECT 1 FROM soap_notes n WHERE n.appointment_id = a.id AND n.status = 'SIGNED')
        ORDER BY a.starts_at`,
      [therapistId],
    );
    return ok({ appointments: rows, outstandingSoap });
  },
});

// Full appointment view for the assigned therapist. Every open is audited.
register({
  name: "therapistAppointment",
  route: "therapist/appointments/{id}",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    const [detail, intake, reviews, history, soap, consents] = await Promise.all([
      one(
        `SELECT a.id, a.starts_at, a.ends_at, a.status, a.pressure, a.flagged_count, a.total_cents,
                c.id AS client_id, c.first_name, c.last_name, c.preferred_name, c.phone, c.email, to_char(c.date_of_birth,'YYYY-MM-DD') AS date_of_birth,
                s.id AS service_id, s.slug AS service_slug, s.name_en AS service_name_en, s.name_es AS service_name_es, d.minutes,
                COALESCE((SELECT json_agg(json_build_object('id', e.id, 'slug', e.slug, 'name_en', e.name_en, 'name_es', e.name_es))
                           FROM appointment_enhancements ae JOIN enhancements e ON e.id = ae.enhancement_id WHERE ae.appointment_id = a.id), '[]') AS enhancements
           FROM appointments a JOIN clients c ON c.id = a.client_id JOIN services s ON s.id = a.service_id
           JOIN service_durations d ON d.id = a.duration_id WHERE a.id = $1`,
        [appt.id],
      ),
      one<{ data_enc: string; concerns_enc: string; flags_enc: string; version: number }>(
        `SELECT i.data_enc, i.version, ai.concerns_enc, ai.flags_enc FROM appointment_intakes ai JOIN intakes i ON i.id = ai.intake_id WHERE ai.appointment_id = $1`,
        [appt.id],
      ),
      q<{ id: string; decision: string; rationale_enc: string; created_at: Date; reviewer: string | null }>(
        `SELECT r.id, r.decision, r.rationale_enc, r.created_at, u.email AS reviewer FROM contraindication_reviews r
           LEFT JOIN users u ON u.id = r.reviewer_id WHERE r.appointment_id = $1 ORDER BY r.created_at`,
        [appt.id],
      ),
      q<{ id: string; starts_at: Date; service_name_en: string; therapist: string; content_enc: string; signed_at: Date }>(
        `SELECT a.id, a.starts_at, s.name_en AS service_name_en, t.display_name AS therapist, n.content_enc, n.signed_at
           FROM soap_notes n JOIN appointments a ON a.id = n.appointment_id JOIN services s ON s.id = a.service_id
           JOIN therapists t ON t.id = n.therapist_id
          WHERE n.client_id = $1 AND n.status = 'SIGNED' AND n.appointment_id <> $2 ORDER BY a.starts_at DESC LIMIT 10`,
        [appt.client_id, appt.id],
      ),
      one<{ id: string; status: string; content_enc: string; signed_at: Date | null; signature_name: string | null; draft_saved_at: Date | null; amendment_count: number }>(
        "SELECT id, status, content_enc, signed_at, signature_name, draft_saved_at, amendment_count FROM soap_notes WHERE appointment_id = $1",
        [appt.id],
      ),
      q("SELECT cf.kind, cs.signed_name, cs.signed_at FROM consent_signatures cs JOIN consent_forms cf ON cf.id = cs.consent_form_id WHERE cs.appointment_id = $1", [appt.id]),
    ]);
    await audit(user.id, "appointment.clinical.read", "appointment", appt.id);
    return ok({
      appointment: detail,
      intake: intake ? decryptJson(intake.data_enc) : null,
      intakeVersion: intake?.version ?? null,
      concerns: intake ? decryptJson(intake.concerns_enc) : null,
      flags: intake ? decryptJson(intake.flags_enc) : [],
      reviews: reviews.map((r) => ({ id: r.id, decision: r.decision, rationale: decryptJson<string>(r.rationale_enc), createdAt: r.created_at, reviewer: r.reviewer })),
      history: history.map((h) => ({ appointmentId: h.id, startsAt: h.starts_at, service: h.service_name_en, therapist: h.therapist, signedAt: h.signed_at, content: decryptJson(h.content_enc) })),
      soap: soap
        ? { id: soap.id, status: soap.status, content: decryptJson(soap.content_enc), signedAt: soap.signed_at, signatureName: soap.signature_name, draftSavedAt: soap.draft_saved_at, amendmentCount: soap.amendment_count }
        : null,
      consents,
    });
  },
});

// Contraindication review: required before a flagged appointment can be confirmed.
register({
  name: "therapistReview",
  route: "therapist/appointments/{id}/review",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    if (appt.status !== "PENDING_REVIEW") throw new HttpError(409, "NOT_PENDING_REVIEW", "This appointment isn't waiting for a review.");
    const body = reviewSchema.parse(await readJson(req));
    const next =
      body.decision === "PROCEED" || body.decision === "PROCEED_WITH_MODIFICATIONS"
        ? "CONFIRMED"
        : body.decision === "CLEARANCE_REQUESTED"
          ? "PENDING_REVIEW"
          : "CANCELLED_BY_BUSINESS";
    await tx(async (c) => {
      await q("INSERT INTO contraindication_reviews (appointment_id, reviewer_id, decision, rationale_enc) VALUES ($1,$2,$3,$4)", [
        appt.id, user.id, body.decision, encryptJson(body.rationale),
      ], c);
      await q(
        `UPDATE appointments SET status = $2, updated_at = now(),
           cancelled_at = CASE WHEN $2 = 'CANCELLED_BY_BUSINESS' THEN now() ELSE cancelled_at END,
           cancelled_by = CASE WHEN $2 = 'CANCELLED_BY_BUSINESS' THEN $3::uuid ELSE cancelled_by END,
           cancel_reason = CASE WHEN $2 = 'CANCELLED_BY_BUSINESS' THEN 'Health review: ' || $4 ELSE cancel_reason END
         WHERE id = $1`,
        [appt.id, next, user.id, body.decision.toLowerCase()],
        c,
      );
      await audit(user.id, "contraindication.review", "appointment", appt.id, { decision: body.decision }, c);
    });
    if (next === "CONFIRMED") await notifyAppointment(appt.id, "review_confirmed");
    else {
      await notifyAppointment(appt.id, "review_follow_up");
      if (next === "CANCELLED_BY_BUSINESS") await refundAppointment(appt.id, "Postponed after health review", user.id);
    }
    return ok({ status: next });
  },
});

const STATUS_FLOW: Record<string, string[]> = {
  CHECKED_IN: ["CONFIRMED"],
  COMPLETED: ["CONFIRMED", "CHECKED_IN"],
  NO_SHOW: ["CONFIRMED"],
};

register({
  name: "therapistStatus",
  route: "therapist/appointments/{id}/status",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    const { status } = z.object({ status: z.enum(["CHECKED_IN", "COMPLETED", "NO_SHOW"]) }).parse(await readJson(req));
    if (appt.status === "PENDING_REVIEW") {
      throw new HttpError(409, "REVIEW_REQUIRED", "Complete the health review before starting this session.");
    }
    if (!STATUS_FLOW[status]!.includes(appt.status)) throw new HttpError(409, "BAD_TRANSITION", `Can't change ${appt.status} to ${status}.`);
    if (status !== "NO_SHOW" && appt.starts_at.getTime() - Date.now() > 2 * 60 * 60 * 1000) {
      throw new HttpError(409, "TOO_EARLY", "This session hasn't started yet.");
    }
    await q("UPDATE appointments SET status = $2, updated_at = now() WHERE id = $1", [appt.id, status]);
    await audit(user.id, "appointment.status", "appointment", appt.id, { status });
    return ok({ status });
  },
});

register({
  name: "soapTemplates",
  route: "therapist/soap-templates",
  methods: ["GET"],
  handler: async (req) => {
    await requireTherapist(req);
    return ok({ templates: await q("SELECT id, name, service_id, body FROM soap_templates WHERE active ORDER BY name") });
  },
});

function hasSection(s: Record<string, unknown>) {
  return Object.values(s).some((v) => (Array.isArray(v) ? v.length > 0 : typeof v === "number" ? true : typeof v === "string" ? v.trim() !== "" : !!v));
}

// Save a SOAP draft (autosave). Signed notes can't be edited here.
register({
  name: "soapDraft",
  route: "therapist/appointments/{id}/soap",
  methods: ["PUT"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    if (!["CHECKED_IN", "COMPLETED"].includes(appt.status)) {
      throw new HttpError(409, "SESSION_NOT_STARTED", "SOAP notes can be written once the session is checked in or completed.");
    }
    const content = soapContentSchema.parse(await readJson(req));
    const existing = await one<{ id: string; status: string }>("SELECT id, status FROM soap_notes WHERE appointment_id = $1", [appt.id]);
    if (existing?.status === "SIGNED") throw new HttpError(409, "ALREADY_SIGNED", "This note is signed. Add an amendment instead.");
    const row = await one<{ id: string; draft_saved_at: Date }>(
      `INSERT INTO soap_notes (appointment_id, client_id, therapist_id, content_enc, draft_saved_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (appointment_id) DO UPDATE SET content_enc = EXCLUDED.content_enc, draft_saved_at = now(), updated_at = now()
       RETURNING id, draft_saved_at`,
      [appt.id, appt.client_id, appt.therapist_id, encryptJson(content)],
    );
    await audit(user.id, "soap.draft.save", "soap_note", row!.id);
    return ok({ id: row!.id, status: "DRAFT", draftSavedAt: row!.draft_saved_at });
  },
});

register({
  name: "soapSign",
  route: "therapist/appointments/{id}/soap/sign",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    if (appt.status !== "COMPLETED") throw new HttpError(409, "SESSION_NOT_COMPLETED", "Mark the session completed before signing the note.");
    const body = z.object({ signatureName: z.string().trim().min(2).max(120), content: soapContentSchema }).parse(await readJson(req));
    const c = body.content as SoapContent;
    const missing = (["subjective", "objective", "assessment", "plan"] as const).filter((k) => !hasSection(c[k] as Record<string, unknown>));
    if (missing.length) throw new HttpError(400, "SOAP_INCOMPLETE", "Every SOAP section needs an entry before signing.", { missing });
    const row = await one<{ id: string; signed_at: Date }>(
      `INSERT INTO soap_notes (appointment_id, client_id, therapist_id, content_enc, status, signed_at, signature_name, draft_saved_at)
       VALUES ($1, $2, $3, $4, 'SIGNED', now(), $5, now())
       ON CONFLICT (appointment_id) DO UPDATE SET content_enc = EXCLUDED.content_enc, status = 'SIGNED', signed_at = now(),
         signature_name = EXCLUDED.signature_name, updated_at = now()
       WHERE soap_notes.status = 'DRAFT'
       RETURNING id, signed_at`,
      [appt.id, appt.client_id, appt.therapist_id, encryptJson(c), body.signatureName],
    );
    if (!row) throw new HttpError(409, "ALREADY_SIGNED", "This note is already signed. Add an amendment instead.");
    await audit(user.id, "soap.sign", "soap_note", row.id);
    return ok({ id: row.id, status: "SIGNED", signedAt: row.signed_at });
  },
});

register({
  name: "soapAmend",
  route: "therapist/appointments/{id}/soap/amend",
  methods: ["POST"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    const body = z.object({ reason: z.string().trim().min(5).max(1000), content: soapContentSchema }).parse(await readJson(req));
    const result = await tx(async (cl) => {
      const note = await one<{ id: string; status: string; content_enc: string; amendment_count: number }>(
        "SELECT id, status, content_enc, amendment_count FROM soap_notes WHERE appointment_id = $1 FOR UPDATE",
        [appt.id],
        cl,
      );
      if (!note || note.status !== "SIGNED") throw new HttpError(409, "NOT_SIGNED", "Only signed notes can be amended.");
      await q("INSERT INTO soap_amendments (soap_note_id, author_id, reason, previous_enc) VALUES ($1,$2,$3,$4)", [note.id, user.id, body.reason, note.content_enc], cl);
      await q("UPDATE soap_notes SET content_enc = $2, amendment_count = amendment_count + 1, updated_at = now() WHERE id = $1", [note.id, encryptJson(body.content)], cl);
      await audit(user.id, "soap.amend", "soap_note", note.id, { amendment: note.amendment_count + 1 }, cl);
      return { id: note.id, amendmentCount: note.amendment_count + 1 };
    });
    return ok(result);
  },
});

register({
  name: "soapAmendments",
  route: "therapist/appointments/{id}/soap/amendments",
  methods: ["GET"],
  handler: async (req) => {
    const user = await requireTherapist(req);
    const appt = await authorizedAppointment(user, req.params.id!);
    const rows = await q<{ id: string; reason: string; previous_enc: string; created_at: Date; author: string | null }>(
      `SELECT m.id, m.reason, m.previous_enc, m.created_at, u.email AS author FROM soap_amendments m
         JOIN soap_notes n ON n.id = m.soap_note_id LEFT JOIN users u ON u.id = m.author_id
        WHERE n.appointment_id = $1 ORDER BY m.created_at`,
      [appt.id],
    );
    await audit(user.id, "soap.amendments.read", "appointment", appt.id);
    return ok({ amendments: rows.map((r) => ({ id: r.id, reason: r.reason, createdAt: r.created_at, author: r.author, previous: decryptJson(r.previous_enc) })) });
  },
});
