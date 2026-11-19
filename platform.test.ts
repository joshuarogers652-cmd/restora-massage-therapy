/**
 * End-to-end API tests against a real PostgreSQL database.
 * All people and data here are fictional.
 */
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "../../api/node_modules/stripe";
import { call, clientAna, clientBen, clientCruz, emptyIntake, manager, nextWeekday, owner, profile, therapistA, therapistB } from "./harness";
import { closePool, q, one } from "../../api/src/database/db";

let services: Record<string, any> = {};
let enh: Record<string, any> = {};
let therapistAId = "";
let therapistBId = "";
const monday = nextWeekday(1, 3);
const sunday = nextWeekday(0, 3);

const consentsFor = (kinds: string[], name: string) => kinds.map((kind) => ({ kind, signedName: name }));

async function firstSlot(serviceId: string, minutes: number, date: string, enhancementIds: string[] = [], therapistId = "any") {
  const r = await call("GET", `availability?serviceId=${serviceId}&minutes=${minutes}&enhancementIds=${enhancementIds.join(",")}&therapistId=${therapistId}&date=${date}`);
  expect(r.status).toBe(200);
  return r.body.slots as { start: string; therapistIds: string[] }[];
}

function booking(over: Record<string, unknown> = {}) {
  return {
    serviceId: services.swedish.id,
    minutes: 60,
    enhancementIds: [],
    therapistId: null,
    profile: profile("Ana"),
    intake: emptyIntake,
    concerns: { areas: ["neck", "shoulders"], bothering: "Tight shoulders from desk work", howLong: "2 months", focus: "Neck and shoulders", pressure: "MEDIUM" },
    consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Ana Testclient"),
    promotionCode: null,
    locale: "en",
    ...over,
  };
}

beforeAll(async () => {
  const r = await call("GET", "catalog");
  services = Object.fromEntries(r.body.services.map((s: any) => [s.slug, s]));
  enh = Object.fromEntries(r.body.enhancements.map((e: any) => [e.slug, e]));
});
afterAll(async () => {
  await closePool();
});

describe("database & public API", () => {
  it("applies migrations and reports health without exposing secrets", async () => {
    const r = await call("GET", "health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", database: "ok", encryption: "configured", payments: "not_configured", email: "not_configured" });
    expect(JSON.stringify(r.body)).not.toContain(process.env.DATA_ENCRYPTION_KEY!);
    expect(r.headers["Cache-Control"]).toBe("no-store");
    expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("offers exactly the five services and never hot stone or medical massage", async () => {
    expect(Object.keys(services).sort()).toEqual(["aromatherapy", "deep-tissue", "prenatal", "sports", "swedish"]);
    const all = JSON.stringify(await call("GET", "catalog")).toLowerCase();
    expect(all).not.toMatch(/hot stone|hot-stone|piedras calientes|medical massage|masaje médico/);
  });

  it("starts with enhancements unbookable until the owner sets time and price", () => {
    for (const e of Object.values(enh)) expect(e.bookable).toBe(false);
    expect(enh["dynamic-cupping"].requires_consents).toContain("DYNAMIC_CUPPING");
  });

  it("has screening for every service, and dynamic cupping is blocked for prenatal", async () => {
    for (const s of Object.values(services)) expect(s.screening.length).toBeGreaterThan(5);
    const r = await call("GET", "catalog");
    expect(r.body.rules.some((x: any) => x.service_id === services.prenatal.id && x.enhancement_a === enh["dynamic-cupping"].id)).toBe(true);
  });

  it("stores contact messages and rejects incomplete ones", async () => {
    expect((await call("POST", "contact", { body: { name: "Pat", email: "pat@example.test", topic: "booking", message: "Do you have Saturday times?", consent: true, locale: "en" } })).status).toBe(201);
    expect((await call("POST", "contact", { body: { name: "", email: "bad", topic: "booking", message: "hi", consent: true } })).status).toBe(400);
  });
});

describe("authentication & roles", () => {
  it("requires sign-in for personal data", async () => {
    expect((await call("GET", "me")).status).toBe(401);
    expect((await call("GET", "me/appointments")).status).toBe(401);
    expect((await call("GET", "admin/overview")).status).toBe(401);
  });

  it("creates new users as clients, and makes ADMIN_EMAILS owners administrators", async () => {
    const a = await call("GET", "me", { as: clientAna });
    expect(a.status).toBe(200);
    expect(a.body.user.roles).toEqual(["client"]);
    const o = await call("GET", "me", { as: owner });
    expect(o.body.user.roles).toContain("admin");
  });

  it("ignores roles claimed in the sign-in header (roles come only from the database)", async () => {
    const spoof = { ...clientBen!, claimRoles: ["admin", "therapist"] };
    expect((await call("GET", "admin/overview", { as: spoof })).status).toBe(403);
    expect((await call("GET", "therapist/schedule", { as: spoof })).status).toBe(403);
    expect((await call("GET", "admin/settings", { as: spoof })).status).toBe(403);
  });

  it("lets the owner grant office-manager access, which can't change settings or see the audit log", async () => {
    await call("GET", "me", { as: manager });
    const users = await call("GET", "admin/users", { as: owner });
    const mgr = users.body.users.find((u: any) => u.email === manager!.email);
    expect((await call("PUT", `admin/users/${mgr.id}/roles`, { as: owner, body: { roles: ["office_manager"] } })).status).toBe(200);
    expect((await call("GET", "admin/overview", { as: manager })).status).toBe(200);
    expect((await call("GET", "admin/settings", { as: manager })).status).toBe(403);
    expect((await call("GET", "admin/audit", { as: manager })).status).toBe(403);
    expect((await call("PUT", `admin/services/${services.swedish.id}`, { as: manager, body: {} })).status).toBe(403);
  });

  it("stops the owner from removing their own admin access", async () => {
    const me = await call("GET", "me", { as: owner });
    expect((await call("PUT", `admin/users/${me.body.user.id}/roles`, { as: owner, body: { roles: ["client"] } })).status).toBe(400);
  });
});

describe("administration setup", () => {
  it("sets business hours and contact details that appear on the public site", async () => {
    const s = await call("GET", "admin/settings", { as: owner });
    const business = { ...s.body.settings.business, phone: "(281) 555-0142", email: "hello@restora.test",
      hours: { "0": null, "1": { open: "09:00", close: "18:00" }, "2": { open: "09:00", close: "18:00" }, "3": { open: "09:00", close: "18:00" }, "4": { open: "09:00", close: "18:00" }, "5": { open: "09:00", close: "18:00" }, "6": { open: "10:00", close: "15:00" } } };
    expect((await call("PUT", "admin/settings/business", { as: owner, body: business })).status).toBe(200);
    const cat = await call("GET", "catalog");
    expect(cat.body.settings.business.phone).toBe("(281) 555-0142");
    expect(cat.body.settings.business.hours["0"]).toBeNull();
  });

  it("rejects turning on online payments while Stripe isn't configured", async () => {
    const r = await call("PUT", "admin/settings/payments", { as: owner, body: { mode: "deposit", depositPercent: 25, holdMinutes: 15 } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("PAYMENTS_NOT_CONFIGURED");
  });

  it("sets enhancement time and price, making them bookable", async () => {
    for (const [slug, minutes, cents] of [["face-massage", 15, 2000], ["foot-scrub", 15, 1500], ["dynamic-cupping", 15, 2500]] as const) {
      const e = enh[slug];
      const body = { name_en: e.name_en, name_es: e.name_es, description_en: e.description_en, description_es: e.description_es, benefits_en: e.benefits_en, benefits_es: e.benefits_es, added_minutes: minutes, price_cents: cents, active: true };
      expect((await call("PUT", `admin/enhancements/${e.id}`, { as: owner, body })).status).toBe(200);
    }
    const cat = await call("GET", "catalog");
    enh = Object.fromEntries(cat.body.enhancements.map((e: any) => [e.slug, e]));
    expect(enh["face-massage"]).toMatchObject({ bookable: true, added_minutes: 15, price_cents: 2000 });
  });

  it("changes a service price", async () => {
    const s = services.swedish;
    const body = { name_en: s.name_en, name_es: s.name_es, summary_en: s.summary_en, summary_es: s.summary_es, description_en: s.description_en, description_es: s.description_es,
      benefits_en: s.benefits_en, benefits_es: s.benefits_es, active: true, sort_order: s.sort_order,
      durations: [{ minutes: 30, price_cents: 3000, active: true }, { minutes: 60, price_cents: 5500, active: true }, { minutes: 90, price_cents: 8000, active: true }] };
    expect((await call("PUT", `admin/services/${s.id}`, { as: owner, body })).status).toBe(200);
    const cat = await call("GET", "catalog");
    services = Object.fromEntries(cat.body.services.map((x: any) => [x.slug, x]));
    expect(services.swedish.durations.find((d: any) => d.minutes === 60).price_cents).toBe(5500);
  });

  it("adds therapists by email; they're linked on first sign-in and only then bookable", async () => {
    const all = Object.values(services).map((s: any) => s.id);
    const hours = [1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, startMinute: 9 * 60, endMinute: 17 * 60 }));
    const a = await call("POST", "admin/therapists", { as: owner, body: { inviteEmail: therapistA!.email, displayName: "Maria Test", serviceIds: all, hours,
      enhancements: [{ enhancementId: enh["face-massage"].id }, { enhancementId: enh["foot-scrub"].id }, { enhancementId: enh["dynamic-cupping"].id, certification: "Cupping cert (fictional)" }] } });
    expect(a.status).toBe(201);
    therapistAId = a.body.id;
    const b = await call("POST", "admin/therapists", { as: owner, body: { inviteEmail: therapistB!.email, displayName: "Lena Test", serviceIds: all, hours, enhancements: [] } });
    therapistBId = b.body.id;
    expect((await call("GET", "catalog")).body.therapists).toHaveLength(0); // nobody signed in yet
    const meA = await call("GET", "me", { as: therapistA });
    expect(meA.body.user.roles).toContain("therapist");
    expect(meA.body.user.therapistId).toBe(therapistAId);
    await call("GET", "me", { as: therapistB });
    expect((await call("GET", "catalog")).body.therapists).toHaveLength(2);
  });
});

describe("availability", () => {
  it("offers times on open days and none on closed days", async () => {
    const mon = await firstSlot(services.swedish.id, 60, monday);
    expect(mon.length).toBeGreaterThan(5);
    expect(mon[0]!.therapistIds).toHaveLength(2);
    expect(await firstSlot(services.swedish.id, 60, sunday)).toHaveLength(0);
  });

  it("only offers dynamic cupping with a qualified therapist", async () => {
    const slots = await firstSlot(services["deep-tissue"].id, 60, monday, [enh["dynamic-cupping"].id]);
    expect(slots.every((s) => s.therapistIds.length === 1 && s.therapistIds[0] === therapistAId)).toBe(true);
  });

  it("refuses blocked combinations (prenatal + cupping)", async () => {
    const r = await call("GET", `availability?serviceId=${services.prenatal.id}&minutes=60&enhancementIds=${enh["dynamic-cupping"].id}&date=${monday}`);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("SELECTION_INVALID");
  });
});

let anaAppt = "";
let anaSlot = "";
describe("booking", () => {
  it("books, confirms, and stores intake and concerns encrypted", async () => {
    const slots = await firstSlot(services.swedish.id, 60, monday);
    anaSlot = slots[4]!.start;
    const r = await call("POST", "bookings", { as: clientAna, body: booking({ startsAt: anaSlot, enhancementIds: [enh["face-massage"].id] }) });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: "CONFIRMED", subtotalCents: 7500, totalCents: 7500, amountDueNowCents: 0, needsReview: false });
    anaAppt = r.body.appointmentId;
    const row = await one<{ data_enc: string; concerns_enc: string }>("SELECT i.data_enc, ai.concerns_enc FROM appointment_intakes ai JOIN intakes i ON i.id = ai.intake_id WHERE ai.appointment_id = $1", [anaAppt]);
    expect(row!.data_enc.startsWith("v1:")).toBe(true);
    expect(row!.concerns_enc).not.toContain("Tight shoulders");
    const sigs = await q("SELECT 1 FROM consent_signatures WHERE appointment_id = $1", [anaAppt]);
    expect(sigs).toHaveLength(2);
  });

  it("accepts a blank optional date of birth", async () => {
    const slots = await firstSlot(services.swedish.id, 30, monday);
    const r = await call("POST", "bookings", { as: clientCruz, body: booking({ minutes: 30, startsAt: slots[slots.length - 1]!.start, profile: { ...profile("Cruz"), dateOfBirth: "", preferredName: "" }, consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Cruz") }) });
    expect(r.status).toBe(201);
  });

  it("requires every consent form", async () => {
    const slots = await firstSlot(services.swedish.id, 60, monday);
    const r = await call("POST", "bookings", { as: clientBen, body: booking({ startsAt: slots[0]!.start, profile: profile("Ben"), consents: consentsFor(["GENERAL_TREATMENT"], "Ben") }) });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("CONSENT_REQUIRED");
  });

  it("requires the separate cupping consent", async () => {
    const slots = await firstSlot(services["deep-tissue"].id, 60, monday, [enh["dynamic-cupping"].id]);
    const r = await call("POST", "bookings", { as: clientBen, body: booking({ serviceId: services["deep-tissue"].id, startsAt: slots[0]!.start, enhancementIds: [enh["dynamic-cupping"].id], profile: profile("Ben") }) });
    expect(r.status).toBe(400);
    expect(r.body.error.details.missing).toContain("DYNAMIC_CUPPING");
  });

  it("removes a taken time from availability and rejects booking it again", async () => {
    const slots = await firstSlot(services.swedish.id, 60, monday, [], therapistAId);
    const ana = (await call("GET", "me/appointments", { as: clientAna })).body.appointments[0];
    const anaTherapistSlots = await firstSlot(services.swedish.id, 60, monday, [], ana.therapist_id);
    expect(anaTherapistSlots.some((s) => s.start === anaSlot)).toBe(false);
    expect(slots.length).toBeGreaterThan(0);
    const r = await call("POST", "bookings", { as: clientBen, body: booking({ startsAt: anaSlot, therapistId: ana.therapist_id, profile: profile("Ben"), consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Ben") }) });
    expect(r.status).toBe(409);
  });

  it("prevents double booking when two clients book the same time at the same moment", async () => {
    const slots = await firstSlot(services.sports.id, 60, monday, [], therapistBId);
    const start = slots[slots.length - 1]!.start;
    const req = (who: typeof clientBen, name: string) =>
      call("POST", "bookings", { as: who, body: booking({ serviceId: services.sports.id, startsAt: start, therapistId: therapistBId, profile: profile(name), consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], name) }) });
    const results = await Promise.all([req(clientBen, "Ben"), req(clientCruz, "Cruz")]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM appointments WHERE therapist_id = $1 AND starts_at = $2 AND status IN ('CONFIRMED','PENDING_REVIEW','HELD')", [therapistBId, start]);
    expect(n!.n).toBe(1);
  });

  it("enforces no-overlap in the database itself, not just in code", async () => {
    const a = await one<any>("SELECT * FROM appointments WHERE id = $1", [anaAppt]);
    await expect(
      q(`INSERT INTO appointments (client_id, therapist_id, service_id, duration_id, starts_at, ends_at, block_ends_at, status, subtotal_cents, total_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'CONFIRMED',0,0)`, [a.client_id, a.therapist_id, a.service_id, a.duration_id, a.starts_at, a.ends_at, a.block_ends_at]),
    ).rejects.toMatchObject({ code: "23P01" });
  });

  it("applies a promotion code", async () => {
    const today = new Date().toISOString().slice(0, 10);
    expect((await call("POST", "admin/promotions", { as: owner, body: { code: "WELCOME10", title_en: "Welcome", title_es: "Bienvenida", discount_type: "PERCENT", discount_value: 10, starts_on: today, ends_on: "2099-12-31" } })).status).toBe(201);
    const chk = await call("POST", "promotions/check", { body: { code: "welcome10", subtotalCents: 5500 } });
    expect(chk.body.discountCents).toBe(550);
    const slots = await firstSlot(services.swedish.id, 60, monday);
    const r = await call("POST", "bookings", { as: clientCruz, body: booking({ startsAt: slots[1]!.start, promotionCode: "WELCOME10", profile: profile("Cruz"), consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Cruz") }) });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ subtotalCents: 5500, discountCents: 550, totalCents: 4950 });
  });
});

let flaggedAppt = "";
describe("contraindication screening", () => {
  it("flags reported conditions and holds the appointment for therapist review", async () => {
    const slots = await firstSlot(services["deep-tissue"].id, 60, monday, [], therapistAId);
    const r = await call("POST", "bookings", { as: clientBen, body: booking({
      serviceId: services["deep-tissue"].id, therapistId: therapistAId, startsAt: slots[2]!.start, profile: profile("Ben"),
      intake: { ...emptyIntake, conditions: ["anticoagulants"], medications: "Blood thinner (fictional test data)" },
      consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Ben Testclient"),
    }) });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("PENDING_REVIEW");
    expect(r.body.needsReview).toBe(true);
    flaggedAppt = r.body.appointmentId;
  });

  it("shows the flags only to the assigned therapist", async () => {
    const a = await call("GET", `therapist/appointments/${flaggedAppt}`, { as: therapistA });
    expect(a.status).toBe(200);
    expect(a.body.flags).toEqual([{ code: "anticoagulants", category: "CLEARANCE_REQUIRED", source: "deep-tissue" }]);
    expect(a.body.intake.medications).toContain("Blood thinner");
    expect((await call("GET", `therapist/appointments/${flaggedAppt}`, { as: therapistB })).status).toBe(404);
    expect((await call("GET", `therapist/appointments/${flaggedAppt}`, { as: clientBen })).status).toBe(403);
  });

  it("can't be bypassed: no check-in or completion before review, and a rationale is required", async () => {
    const s = await call("POST", `therapist/appointments/${flaggedAppt}/status`, { as: therapistA, body: { status: "COMPLETED" } });
    expect(s.status).toBe(409);
    expect(s.body.error.code).toBe("REVIEW_REQUIRED");
    expect((await call("POST", `therapist/appointments/${flaggedAppt}/review`, { as: therapistA, body: { decision: "PROCEED", rationale: "ok" } })).status).toBe(400);
  });

  it("keeps the appointment pending while clearance is requested, then confirms after review", async () => {
    let r = await call("POST", `therapist/appointments/${flaggedAppt}/review`, { as: therapistA, body: { decision: "CLEARANCE_REQUESTED", rationale: "Asked client for physician note before deeper work." } });
    expect(r.body.status).toBe("PENDING_REVIEW");
    r = await call("POST", `therapist/appointments/${flaggedAppt}/review`, { as: therapistA, body: { decision: "PROCEED_WITH_MODIFICATIONS", rationale: "Clearance received. Light-to-medium pressure only." } });
    expect(r.body.status).toBe("CONFIRMED");
    const d = await call("GET", `therapist/appointments/${flaggedAppt}`, { as: therapistA });
    expect(d.body.reviews).toHaveLength(2);
    const raw = await q<{ rationale_enc: string }>("SELECT rationale_enc FROM contraindication_reviews WHERE appointment_id = $1", [flaggedAppt]);
    expect(raw[0]!.rationale_enc).not.toContain("physician");
  });
});

describe("client portal", () => {
  it("lists only the client's own appointments, without therapist notes", async () => {
    const r = await call("GET", "me/appointments", { as: clientAna });
    expect(r.body.appointments.every((a: any) => !("soap" in a) && !("content_enc" in a))).toBe(true);
    expect(r.body.appointments).toHaveLength(1);
  });

  it("lets a client update and re-read their intake (new version)", async () => {
    expect((await call("PUT", "me/intake", { as: clientAna, body: { ...emptyIntake, allergies: "Latex (fictional)" } })).status).toBe(200);
    const r = await call("GET", "me/intake", { as: clientAna });
    expect(r.body.intake.allergies).toBe("Latex (fictional)");
    expect(r.body.version).toBe(2);
  });

  it("blocks cancelling another client's appointment", async () => {
    expect((await call("POST", `me/appointments/${anaAppt}/cancel`, { as: clientBen, body: {} })).status).toBe(404);
  });

  it("reschedules, then cancels outside the cancellation window", async () => {
    const appt = (await call("GET", "me/appointments", { as: clientAna })).body.appointments[0];
    const slots = await firstSlot(services.swedish.id, 60, monday, [enh["face-massage"].id], appt.therapist_id);
    const target = slots.find((s) => s.start !== appt.starts_at)!;
    const r = await call("POST", `me/appointments/${appt.id}/reschedule`, { as: clientAna, body: { startsAt: target.start } });
    expect(r.status).toBe(200);
    anaAppt = r.body.appointmentId;
    const old = await one<{ status: string }>("SELECT status FROM appointments WHERE id = $1", [appt.id]);
    expect(old!.status).toBe("RESCHEDULED");
    const c = await call("POST", `me/appointments/${anaAppt}/cancel`, { as: clientAna, body: { reason: "Schedule change" } });
    expect(c.status).toBe(200);
    expect(c.body.status).toBe("CANCELLED_BY_CLIENT");
  });

  it("refuses online cancellation inside the window", async () => {
    await q("UPDATE settings SET value = jsonb_set(value, '{cancellationWindowHours}', '240') WHERE key = 'booking'");
    const r = await call("POST", `me/appointments/${flaggedAppt}/cancel`, { as: clientBen, body: {} });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("CANCEL_WINDOW_PASSED");
    await q("UPDATE settings SET value = jsonb_set(value, '{cancellationWindowHours}', '24') WHERE key = 'booking'");
  });

  it("accepts a records request that the owner can see and complete", async () => {
    expect((await call("POST", "me/records-requests", { as: clientBen, body: { details: "Copy of my session notes" } })).status).toBe(201);
    const list = await call("GET", "admin/records-requests", { as: owner });
    expect(list.body.requests[0].first_name).toBe("Ben");
    expect((await call("GET", "admin/records-requests", { as: manager })).status).toBe(403);
  });
});

describe("SOAP notes", () => {
  const content = {
    subjective: { concerns: "Low back tightness", symptoms: "Dull ache after sitting", goals: "Ease tension", changes: "", healthUpdates: "Clearance received" },
    objective: { observations: "Hypertonic paraspinals", areasTreated: ["lower_back", "hips"], techniques: "Effleurage, petrissage", pressure: "MEDIUM", durationMinutes: 60, clientResponse: "Tolerated well", enhancementsPerformed: "", cuppingAreas: "", productsUsed: "Standard hypoallergenic lotion" },
    assessment: { tolerance: "Good", progress: "Reported less tightness", observedChanges: "Tissue softened", limitations: "Pressure limited per clearance", followUp: "" },
    plan: { nextFocus: "Hips", interval: "2 weeks", selfCare: "Gentle stretching", referrals: "" },
  };

  beforeAll(async () => {
    // Move the confirmed appointment to "now" so it can be checked in and completed.
    await q("UPDATE appointments SET starts_at = now() - interval '70 minutes', ends_at = now() - interval '10 minutes', block_ends_at = now() - interval '1 minute' WHERE id = $1", [flaggedAppt]);
  });

  it("can't be written before check-in", async () => {
    const r = await call("PUT", `therapist/appointments/${flaggedAppt}/soap`, { as: therapistA, body: content });
    expect(r.status).toBe(409);
  });

  it("saves drafts, refuses to sign incomplete notes, signs complete ones", async () => {
    expect((await call("POST", `therapist/appointments/${flaggedAppt}/status`, { as: therapistA, body: { status: "CHECKED_IN" } })).status).toBe(200);
    const draft = await call("PUT", `therapist/appointments/${flaggedAppt}/soap`, { as: therapistA, body: { ...content, plan: { nextFocus: "", interval: "", selfCare: "", referrals: "" } } });
    expect(draft.status).toBe(200);
    expect(draft.body.status).toBe("DRAFT");
    expect((await call("POST", `therapist/appointments/${flaggedAppt}/soap/sign`, { as: therapistA, body: { signatureName: "Maria Test", content } })).status).toBe(409); // not completed
    expect((await call("POST", `therapist/appointments/${flaggedAppt}/status`, { as: therapistA, body: { status: "COMPLETED" } })).status).toBe(200);
    const bad = await call("POST", `therapist/appointments/${flaggedAppt}/soap/sign`, { as: therapistA, body: { signatureName: "Maria Test", content: { ...content, plan: { nextFocus: "", interval: "", selfCare: "", referrals: "" } } } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.missing).toEqual(["plan"]);
    const ok = await call("POST", `therapist/appointments/${flaggedAppt}/soap/sign`, { as: therapistA, body: { signatureName: "Maria Test", content } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("SIGNED");
  });

  it("locks signed notes: edits go through amendments with history", async () => {
    expect((await call("PUT", `therapist/appointments/${flaggedAppt}/soap`, { as: therapistA, body: content })).status).toBe(409);
    const a = await call("POST", `therapist/appointments/${flaggedAppt}/soap/amend`, { as: therapistA, body: { reason: "Corrected interval", content: { ...content, plan: { ...content.plan, interval: "3 weeks" } } } });
    expect(a.body.amendmentCount).toBe(1);
    const h = await call("GET", `therapist/appointments/${flaggedAppt}/soap/amendments`, { as: therapistA });
    expect(h.body.amendments[0].previous.plan.interval).toBe("2 weeks");
    const d = await call("GET", `therapist/appointments/${flaggedAppt}`, { as: therapistA });
    expect(d.body.soap.content.plan.interval).toBe("3 weeks");
  });

  it("is protected by the database too (no silent edits, no history deletion)", async () => {
    await expect(q("UPDATE soap_notes SET content_enc = 'v1:x:y:z' WHERE appointment_id = $1", [flaggedAppt])).rejects.toThrow(/amendment/);
    await expect(q("UPDATE soap_notes SET status = 'DRAFT' WHERE appointment_id = $1", [flaggedAppt])).rejects.toThrow(/signed/);
    await expect(q("DELETE FROM audit_log")).rejects.toThrow(/append-only/);
  });

  it("stores notes encrypted and audits every read", async () => {
    const raw = await one<{ content_enc: string }>("SELECT content_enc FROM soap_notes WHERE appointment_id = $1", [flaggedAppt]);
    expect(raw!.content_enc).not.toContain("paraspinals");
    const reads = await q("SELECT 1 FROM audit_log WHERE action = 'appointment.clinical.read' AND entity_id = $1", [flaggedAppt]);
    expect(reads.length).toBeGreaterThanOrEqual(2);
    const denied = await q("SELECT 1 FROM audit_log WHERE action = 'access.denied' AND entity_id = $1", [flaggedAppt]);
    expect(denied.length).toBeGreaterThanOrEqual(1);
  });

  it("is never shown to clients and is counted on the admin dashboard", async () => {
    expect((await call("GET", `therapist/appointments/${flaggedAppt}`, { as: clientBen })).status).toBe(403);
    const o = await call("GET", "admin/overview", { as: owner });
    expect(o.body.soap_signed).toBe(1);
    expect(o.body.unread_messages).toBe(1);
  });
});

describe("payments (Stripe)", () => {
  it("won't take online-payment bookings while Stripe isn't configured", async () => {
    await q("UPDATE settings SET value = jsonb_set(value, '{mode}', '\"deposit\"') WHERE key = 'payments'");
    const slots = await firstSlot(services.swedish.id, 60, monday);
    const r = await call("POST", "bookings", { as: clientCruz, body: booking({ startsAt: slots[0]!.start, profile: profile("Cruz"), consents: consentsFor(["CANCELLATION_POLICY", "GENERAL_TREATMENT"], "Cruz") }) });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("PAYMENTS_NOT_CONFIGURED");
    await q("UPDATE settings SET value = jsonb_set(value, '{mode}', '\"none\"') WHERE key = 'payments'");
    expect((await call("POST", "payments/webhook", { raw: "{}" })).status).toBe(503);
  });

  it("verifies webhook signatures and confirms a held appointment exactly once", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fictional_for_unit_tests";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_fictional";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_" + crypto.randomBytes(16).toString("hex");
    try {
      const slots = await firstSlot(services.aromatherapy.id, 60, monday);
      const cruz = await one<{ id: string }>("SELECT id FROM clients WHERE first_name = 'Cruz'");
      const appt = await one<any>("SELECT * FROM appointments WHERE client_id = $1 LIMIT 1", [cruz!.id]);
      const start = new Date(slots[0]!.start);
      const held = await one<{ id: string }>(
        `INSERT INTO appointments (client_id, therapist_id, service_id, duration_id, starts_at, ends_at, block_ends_at, status, hold_expires_at, subtotal_cents, total_cents, amount_due_now_cents)
         SELECT $1, $2, s.id, d.id, $3, $3::timestamptz + interval '60 minutes', $3::timestamptz + interval '75 minutes', 'HELD', now() + interval '15 minutes', 5500, 5500, 1375
           FROM services s JOIN service_durations d ON d.service_id = s.id AND d.minutes = 60 WHERE s.slug = 'aromatherapy' RETURNING id`,
        [cruz!.id, slots[0]!.therapistIds[0], start],
      );
      await q("INSERT INTO payments (appointment_id, client_id, kind, status, amount_cents, stripe_payment_intent_id) VALUES ($1,$2,'DEPOSIT','REQUIRES_PAYMENT',1375,'pi_test_fictional_1')", [held!.id, cruz!.id]);
      const event = { id: "evt_test_1", object: "event", type: "payment_intent.succeeded", data: { object: { id: "pi_test_fictional_1", object: "payment_intent" } } };
      const payload = JSON.stringify(event);
      const stripe = new Stripe("sk_test_fictional_for_unit_tests");
      const good = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });

      expect((await call("POST", "payments/webhook", { raw: payload, headers: { "stripe-signature": "t=1,v1=forged" } })).status).toBe(400);
      const r1 = await call("POST", "payments/webhook", { raw: payload, headers: { "stripe-signature": good } });
      expect(r1.status).toBe(200);
      const after = await one<{ status: string }>("SELECT status FROM appointments WHERE id = $1", [held!.id]);
      expect(after!.status).toBe("CONFIRMED");
      expect((await one<{ status: string }>("SELECT status FROM payments WHERE stripe_payment_intent_id = 'pi_test_fictional_1'"))!.status).toBe("SUCCEEDED");
      const r2 = await call("POST", "payments/webhook", { raw: payload, headers: { "stripe-signature": good } });
      expect(r2.body.duplicate).toBe(true);
      expect(appt).toBeTruthy();
    } finally {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_PUBLISHABLE_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it("records refunds for manual handling when Stripe is not configured", async () => {
    const p = await one<{ id: string }>("SELECT id FROM payments WHERE stripe_payment_intent_id = 'pi_test_fictional_1'");
    const r = await call("POST", `admin/payments/${p!.id}/refund`, { as: owner, body: { amountCents: 1375, reason: "Client cancelled (test)" } });
    expect(r.body.status).toBe("NEEDS_MANUAL");
    expect((await call("POST", `admin/payments/${p!.id}/refund`, { as: manager, body: { amountCents: 100, reason: "x" } })).status).toBe(403);
  });
});

describe("fail-safe behaviour", () => {
  it("refuses to read or store health records without the encryption key", async () => {
    const key = process.env.DATA_ENCRYPTION_KEY;
    delete process.env.DATA_ENCRYPTION_KEY;
    try {
      const r = await call("GET", "me/intake", { as: clientAna });
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe("ENCRYPTION_NOT_CONFIGURED");
    } finally {
      process.env.DATA_ENCRYPTION_KEY = key;
    }
  });

  it("returns a clear error for invalid input instead of crashing", async () => {
    const r = await call("POST", "bookings", { as: clientAna, raw: "{not json" });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("BAD_JSON");
  });
});
