import { DateTime } from "luxon";
import { HttpError, ok, readJson, register, created } from "../http";
import { dbConfigured, one, q } from "../database/db";
import { ensureMigrated, migrationState } from "../database/migrate";
import { contactSchema } from "../models/schemas";
import { enhancementBookable, evaluateSelection, loadCatalog } from "../services/catalog";
import { encryptionConfigured } from "../services/crypto";
import { emailConfigured, smsConfigured } from "../services/notify";
import { stripeConfigured } from "../services/payments";
import { getAllSettings } from "../services/settings";
import { findSlots } from "../services/availability";

// Health check: says which integrations are configured. Never returns secret values.
register({
  name: "health",
  route: "health",
  methods: ["GET"],
  skipMigrate: true,
  handler: async () => {
    let database = "not_configured";
    if (dbConfigured()) {
      try {
        await ensureMigrated();
        await one("SELECT 1");
        database = "ok";
      } catch {
        database = migrationState().error ? "migration_failed" : "unreachable";
      }
    }
    return ok({
      status: database === "ok" ? "ok" : "degraded",
      database,
      migrationError: database === "migration_failed" ? migrationState().error : undefined,
      encryption: encryptionConfigured() ? "configured" : "not_configured",
      payments: stripeConfigured() ? "configured" : "not_configured",
      email: emailConfigured() ? "configured" : "not_configured",
      sms: smsConfigured() ? "configured" : "not_configured",
      adminEmailsSet: !!process.env.ADMIN_EMAILS,
    });
  },
});

// Everything the public site needs, in one request. Non-sensitive only.
register({
  name: "catalog",
  route: "catalog",
  methods: ["GET"],
  handler: async () => {
    const [catalog, settings, therapists, consentForms] = await Promise.all([
      loadCatalog(),
      getAllSettings(),
      q<{ id: string; display_name: string; bio_en: string | null; bio_es: string | null; service_ids: string[]; enhancement_ids: string[] }>(
        `SELECT t.id, t.display_name, t.bio_en, t.bio_es,
                COALESCE((SELECT array_agg(service_id) FROM therapist_services WHERE therapist_id = t.id), '{}') AS service_ids,
                COALESCE((SELECT array_agg(enhancement_id) FROM therapist_enhancements WHERE therapist_id = t.id), '{}') AS enhancement_ids
           FROM therapists t WHERE t.active AND t.user_id IS NOT NULL ORDER BY t.display_name`,
      ),
      q("SELECT kind, version, title_en, title_es, body_en, body_es FROM consent_forms WHERE active ORDER BY kind"),
    ]);
    return ok({
      services: catalog.services,
      enhancements: catalog.enhancements.map((e) => ({ ...e, bookable: enhancementBookable(e) })),
      rules: catalog.rules,
      screeningItems: catalog.screeningItems,
      therapists,
      consentForms,
      settings: {
        business: settings.business,
        booking: {
          onlineBookingEnabled: settings.booking.onlineBookingEnabled,
          maxDaysAhead: settings.booking.maxDaysAhead,
          minNoticeHours: settings.booking.minNoticeHours,
          cancellationWindowHours: settings.booking.cancellationWindowHours,
          rescheduleWindowHours: settings.booking.rescheduleWindowHours,
        },
        payments: { mode: settings.payments.mode, depositPercent: settings.payments.depositPercent, configured: stripeConfigured() },
        content: settings.content,
      },
    });
  },
});

// Available start times for a day.
register({
  name: "availability",
  route: "availability",
  methods: ["GET"],
  handler: async (req) => {
    const p = req.query;
    const date = p.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "BAD_DATE", "Use a date like 2026-12-01.");
    const catalog = await loadCatalog();
    const service = catalog.services.find((s) => s.id === p.get("serviceId"));
    if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND");
    const enhancementIds = (p.get("enhancementIds") ?? "").split(",").filter(Boolean);
    const sel = evaluateSelection(catalog, service, Number(p.get("minutes")), enhancementIds);
    if (!sel.ok) throw new HttpError(400, "SELECTION_INVALID", "This combination can't be booked.", sel.problems);
    const therapistId = p.get("therapistId");
    const slots = await findSlots({
      date,
      serviceId: service.id,
      totalMinutes: sel.totalMinutes,
      qualificationEnhancementIds: sel.qualificationRequired,
      therapistId: therapistId && therapistId !== "any" ? therapistId : null,
      excludeAppointmentId: p.get("excludeAppointmentId"),
    });
    return ok({ date, totalMinutes: sel.totalMinutes, subtotalCents: sel.subtotalCents, slots });
  },
});

register({
  name: "promotionCheck",
  route: "promotions/check",
  methods: ["POST"],
  handler: async (req) => {
    const body = await readJson<{ code?: string; subtotalCents?: number }>(req);
    const code = String(body.code ?? "").trim();
    const subtotal = Math.max(0, Math.round(Number(body.subtotalCents) || 0));
    const promo = await one<{ discount_type: string; discount_value: number; title_en: string; title_es: string; max_redemptions: number | null; redemptions: number }>(
      `SELECT discount_type, discount_value, title_en, title_es, max_redemptions, redemptions FROM promotions
        WHERE upper(code) = upper($1) AND active AND current_date BETWEEN starts_on AND ends_on`,
      [code],
    );
    if (!promo || (promo.max_redemptions !== null && promo.redemptions >= promo.max_redemptions)) {
      throw new HttpError(404, "PROMO_INVALID", "That promotion code isn't valid.");
    }
    const discount = promo.discount_type === "PERCENT" ? Math.round((subtotal * promo.discount_value) / 100) : Math.min(subtotal, promo.discount_value);
    return ok({ title_en: promo.title_en, title_es: promo.title_es, discountCents: discount });
  },
});

// Contact form: messages are stored for the admin dashboard (no email required).
register({
  name: "contact",
  route: "contact",
  methods: ["POST"],
  handler: async (req) => {
    const body = contactSchema.parse(await readJson(req));
    if (body.company) return created({ ok: true }); // honeypot
    const recent = await one<{ n: number }>(
      "SELECT count(*)::int AS n FROM contact_messages WHERE lower(email) = lower($1) AND created_at > now() - interval '1 hour'",
      [body.email],
    );
    if ((recent?.n ?? 0) >= 5) throw new HttpError(429, "TOO_MANY", "You've sent several messages recently. Please try again later.");
    await q("INSERT INTO contact_messages (name, email, phone, topic, message, locale) VALUES ($1,$2,$3,$4,$5,$6)", [
      body.name, body.email, body.phone, body.topic, body.message, body.locale,
    ]);
    return created({ ok: true, receivedAt: DateTime.now().toISO() });
  },
});
