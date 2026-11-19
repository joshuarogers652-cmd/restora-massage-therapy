import type { PoolClient } from "pg";
import { q } from "../database/db";

export type Category = "POSTPONE_OR_REFER" | "MODIFY_TREATMENT" | "CLEARANCE_REQUIRED";
export type ScreeningRef = { code: string; category: Category };

export type Service = {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  summary_en: string;
  summary_es: string;
  description_en: string;
  description_es: string;
  expect_en: string[];
  expect_es: string[];
  benefits_en: string[];
  benefits_es: string[];
  candidates_en: string[];
  candidates_es: string[];
  notes_en: string[];
  notes_es: string[];
  pressure_options: string[];
  requires_consents: string[];
  active: boolean;
  sort_order: number;
  durations: { id: string; minutes: number; price_cents: number | null; active: boolean }[];
  screening: ScreeningRef[];
};

export type Enhancement = {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  benefits_en: string[];
  benefits_es: string[];
  requirements_en: string[];
  requirements_es: string[];
  added_minutes: number | null;
  price_cents: number | null;
  requires_consents: string[];
  requires_qualification: boolean;
  active: boolean;
  sort_order: number;
  screening: ScreeningRef[];
};

export type Rule = {
  id: string;
  kind: "SERVICE_BLOCKS_ENHANCEMENT" | "ENHANCEMENTS_INCOMPATIBLE";
  service_id: string | null;
  enhancement_a: string;
  enhancement_b: string | null;
  reason_en: string;
  reason_es: string;
};

export type Catalog = {
  services: Service[];
  enhancements: Enhancement[];
  rules: Rule[];
  screeningItems: { code: string; label_en: string; label_es: string }[];
};

export async function loadCatalog(opts: { includeInactive?: boolean } = {}, client?: PoolClient): Promise<Catalog> {
  const where = opts.includeInactive ? "" : "WHERE active";
  const [services, durations, sScreen, enhancements, eScreen, rules, screeningItems] = await Promise.all([
    q<Omit<Service, "durations" | "screening">>(`SELECT * FROM services ${where} ORDER BY sort_order, name_en`, [], client),
    q<{ id: string; service_id: string; minutes: number; price_cents: number | null; active: boolean }>(
      "SELECT id, service_id, minutes, price_cents, active FROM service_durations ORDER BY minutes",
      [],
      client,
    ),
    q<{ service_id: string; code: string; category: Category }>("SELECT service_id, code, category FROM service_screening", [], client),
    q<Omit<Enhancement, "screening">>(`SELECT * FROM enhancements ${where} ORDER BY sort_order, name_en`, [], client),
    q<{ enhancement_id: string; code: string; category: Category }>("SELECT enhancement_id, code, category FROM enhancement_screening", [], client),
    q<Rule>("SELECT id, kind, service_id, enhancement_a, enhancement_b, reason_en, reason_es FROM enhancement_rules", [], client),
    q<{ code: string; label_en: string; label_es: string }>("SELECT code, label_en, label_es FROM screening_items ORDER BY sort_order", [], client),
  ]);
  return {
    services: services.map((s) => ({
      ...s,
      durations: durations
        .filter((d) => d.service_id === s.id && (opts.includeInactive || d.active))
        .map(({ service_id: _s, ...d }) => d),
      screening: sScreen.filter((x) => x.service_id === s.id).map(({ code, category }) => ({ code, category })),
    })),
    enhancements: enhancements.map((e) => ({
      ...e,
      screening: eScreen.filter((x) => x.enhancement_id === e.id).map(({ code, category }) => ({ code, category })),
    })),
    rules,
    screeningItems,
  };
}

/** An enhancement can be booked online only once the admin sets its time and price. */
export function enhancementBookable(e: Enhancement) {
  return e.active && e.price_cents !== null && e.added_minutes !== null;
}

export type SelectionProblem =
  | { code: "UNKNOWN_DURATION" }
  | { code: "DURATION_NOT_PRICED" }
  | { code: "UNKNOWN_ENHANCEMENT"; id: string }
  | { code: "ENHANCEMENT_NOT_CONFIGURED"; id: string }
  | { code: "DUPLICATE_ENHANCEMENT"; id: string }
  | { code: "BLOCKED_FOR_SERVICE"; id: string; reason_en: string; reason_es: string }
  | { code: "INCOMPATIBLE"; a: string; b: string; reason_en: string; reason_es: string };

/** Pure validation of a service + length + enhancements choice. Used by availability and booking. */
export function evaluateSelection(catalog: Catalog, service: Service, minutes: number, enhancementIds: string[]) {
  const problems: SelectionProblem[] = [];
  const duration = service.durations.find((d) => d.minutes === minutes && d.active);
  if (!duration) problems.push({ code: "UNKNOWN_DURATION" });
  else if (duration.price_cents === null) problems.push({ code: "DURATION_NOT_PRICED" });

  const chosen: Enhancement[] = [];
  const seen = new Set<string>();
  for (const id of enhancementIds) {
    if (seen.has(id)) {
      problems.push({ code: "DUPLICATE_ENHANCEMENT", id });
      continue;
    }
    seen.add(id);
    const e = catalog.enhancements.find((x) => x.id === id && x.active);
    if (!e) problems.push({ code: "UNKNOWN_ENHANCEMENT", id });
    else if (!enhancementBookable(e)) problems.push({ code: "ENHANCEMENT_NOT_CONFIGURED", id });
    else chosen.push(e);
  }
  for (const r of catalog.rules) {
    if (r.kind === "SERVICE_BLOCKS_ENHANCEMENT" && r.service_id === service.id && seen.has(r.enhancement_a)) {
      problems.push({ code: "BLOCKED_FOR_SERVICE", id: r.enhancement_a, reason_en: r.reason_en, reason_es: r.reason_es });
    }
    if (r.kind === "ENHANCEMENTS_INCOMPATIBLE" && r.enhancement_b && seen.has(r.enhancement_a) && seen.has(r.enhancement_b)) {
      problems.push({ code: "INCOMPATIBLE", a: r.enhancement_a, b: r.enhancement_b, reason_en: r.reason_en, reason_es: r.reason_es });
    }
  }
  const totalMinutes = (duration?.minutes ?? 0) + chosen.reduce((s, e) => s + (e.added_minutes ?? 0), 0);
  const subtotalCents = (duration?.price_cents ?? 0) + chosen.reduce((s, e) => s + (e.price_cents ?? 0), 0);
  const requiredConsents = Array.from(
    new Set(["CANCELLATION_POLICY", ...service.requires_consents, ...chosen.flatMap((e) => e.requires_consents)]),
  );
  return {
    ok: problems.length === 0,
    problems,
    duration,
    enhancements: chosen,
    totalMinutes,
    subtotalCents,
    requiredConsents,
    qualificationRequired: chosen.filter((e) => e.requires_qualification).map((e) => e.id),
  };
}

/**
 * Screening flags = the conditions the client reported that appear on the
 * checklist for this service or its enhancements. The system only flags;
 * a therapist always decides.
 */
export function computeFlags(service: Service, enhancements: Enhancement[], conditions: string[]) {
  const reported = new Set(conditions);
  const flags: { code: string; category: Category; source: string }[] = [];
  for (const s of service.screening) if (reported.has(s.code)) flags.push({ ...s, source: service.slug });
  for (const e of enhancements) for (const s of e.screening) if (reported.has(s.code)) flags.push({ ...s, source: e.slug });
  return flags;
}
