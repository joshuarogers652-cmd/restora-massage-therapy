import { describe, expect, it } from "vitest";
import { computeFlags, evaluateSelection, type Catalog, type Enhancement, type Service } from "../../api/src/services/catalog";
import { reportedConditions } from "../../api/src/services/booking";
import { encryptJson, decryptJson } from "../../api/src/services/crypto";
import en from "../../src/locales/en.json";
import es from "../../src/locales/es.json";

const svc = (over: Partial<Service> = {}): Service => ({
  id: "s1", slug: "prenatal", name_en: "", name_es: "", summary_en: "", summary_es: "", description_en: "", description_es: "",
  expect_en: [], expect_es: [], benefits_en: [], benefits_es: [], candidates_en: [], candidates_es: [], notes_en: [], notes_es: [],
  pressure_options: ["LIGHT"], requires_consents: ["GENERAL_TREATMENT", "PRENATAL"], active: true, sort_order: 1,
  durations: [{ id: "d60", minutes: 60, price_cents: 5500, active: true }, { id: "d90", minutes: 90, price_cents: null, active: true }],
  screening: [{ code: "high_risk_pregnancy", category: "CLEARANCE_REQUIRED" }, { code: "fever", category: "POSTPONE_OR_REFER" }],
  ...over,
});
const enh = (id: string, over: Partial<Enhancement> = {}): Enhancement => ({
  id, slug: id, name_en: id, name_es: id, description_en: "", description_es: "", benefits_en: [], benefits_es: [], requirements_en: [], requirements_es: [],
  added_minutes: 15, price_cents: 2000, requires_consents: [], requires_qualification: false, active: true, sort_order: 1, screening: [], ...over,
});
const catalog = (enhancements: Enhancement[], rules: Catalog["rules"] = []): Catalog => ({ services: [svc()], enhancements, rules, screeningItems: [] });

describe("selection rules", () => {
  it("adds time, price and consents for chosen enhancements", () => {
    const c = catalog([enh("face"), enh("cup", { requires_consents: ["DYNAMIC_CUPPING"], requires_qualification: true })]);
    const r = evaluateSelection(c, svc({ slug: "swedish" }), 60, ["face", "cup"]);
    expect(r.ok).toBe(true);
    expect(r.totalMinutes).toBe(90);
    expect(r.subtotalCents).toBe(9500);
    expect(r.requiredConsents).toEqual(expect.arrayContaining(["CANCELLATION_POLICY", "GENERAL_TREATMENT", "PRENATAL", "DYNAMIC_CUPPING"]));
    expect(r.qualificationRequired).toEqual(["cup"]);
  });

  it("refuses unpriced lengths, unconfigured enhancements, duplicates and blocked/incompatible combinations", () => {
    const c = catalog([enh("face"), enh("cup"), enh("draft", { price_cents: null })], [
      { id: "r1", kind: "SERVICE_BLOCKS_ENHANCEMENT", service_id: "s1", enhancement_a: "cup", enhancement_b: null, reason_en: "", reason_es: "" },
      { id: "r2", kind: "ENHANCEMENTS_INCOMPATIBLE", service_id: null, enhancement_a: "face", enhancement_b: "draft", reason_en: "", reason_es: "" },
    ]);
    expect(evaluateSelection(c, svc(), 90, []).problems.map((p) => p.code)).toEqual(["DURATION_NOT_PRICED"]);
    const r = evaluateSelection(c, svc(), 60, ["cup", "cup", "draft", "nope"]);
    expect(r.problems.map((p) => p.code).sort()).toEqual(["BLOCKED_FOR_SERVICE", "DUPLICATE_ENHANCEMENT", "ENHANCEMENT_NOT_CONFIGURED", "UNKNOWN_ENHANCEMENT"]);
    const r2 = evaluateSelection(catalog([enh("face"), enh("foot")], [{ id: "x", kind: "ENHANCEMENTS_INCOMPATIBLE", service_id: null, enhancement_a: "face", enhancement_b: "foot", reason_en: "", reason_es: "" }]), svc({ id: "s2" }), 60, ["face", "foot"]);
    expect(r2.problems.map((p) => p.code)).toEqual(["INCOMPATIBLE"]);
  });
});

describe("screening flags", () => {
  it("flags only conditions on this service's or enhancement's checklist", () => {
    const flags = computeFlags(svc(), [enh("cup", { screening: [{ code: "anticoagulants", category: "CLEARANCE_REQUIRED" }] })], ["fever", "anticoagulants", "unrelated"]);
    expect(flags).toEqual([
      { code: "fever", category: "POSTPONE_OR_REFER", source: "prenatal" },
      { code: "anticoagulants", category: "CLEARANCE_REQUIRED", source: "cup" },
    ]);
  });

  it("derives pregnancy and allergy flags from the intake answers", () => {
    const conditions = reportedConditions({
      conditions: [], allergies: "nuts", skinSensitivities: "", medications: "", injuries: "", surgeries: "", pregnant: true, pregnancyWeeks: 20,
      underPhysicianCare: false, physicianClearance: "", pressurePreference: null, goals: [], preferences: "", emergencyName: "", emergencyPhone: "",
    });
    expect(conditions.sort()).toEqual(["allergies", "pregnancy"]);
  });
});

describe("encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const a = encryptJson({ note: "fictional" });
    const b = encryptJson({ note: "fictional" });
    expect(a).not.toBe(b);
    expect(decryptJson(a)).toEqual({ note: "fictional" });
    const tampered = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptJson(tampered)).toThrow();
  });
});

describe("translations", () => {
  const leaves = (o: unknown, p = ""): string[] =>
    o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k)) : [p];
  it("Spanish has every English key", () => {
    expect(leaves(es).sort()).toEqual(leaves(en).sort());
  });
  it("keeps the brand name in both languages and never mentions excluded services outside the notice", () => {
    expect(JSON.stringify(es)).toContain("RESTORA");
    for (const dict of [en, es]) {
      const { notOffered: _n, ...rest } = dict.services;
      expect(JSON.stringify({ ...dict, services: rest }).toLowerCase()).not.toMatch(/hot stone|piedras calientes|medical massage|masaje médico/);
    }
  });
});
