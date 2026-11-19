import { useI18n } from "@/contexts/I18nContext";
import { BodyDiagram } from "@/components/BodyDiagram";
import { Field } from "@/components/ui";
import type { Catalog, Concerns, Intake, Pressure } from "@/types";
import { cn } from "@/utils/format";

const GOALS = ["relaxation", "tension", "comfort", "recovery", "wellness", "specific_areas"];
// Asked separately (pregnancy question, allergies field), so not repeated in the checklist.
const DERIVED = new Set(["pregnancy", "allergies"]);

/** Health history. Sent to the API and stored encrypted; never kept in the browser. */
export function IntakeForm({ value, onChange, screeningItems }: { value: Intake; onChange: (v: Intake) => void; screeningItems: Catalog["screeningItems"] }) {
  const { t, pick } = useI18n();
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => onChange({ ...value, [k]: v });
  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="font-display text-2xl font-semibold text-brand-deep">{t("intake.conditionsTitle")}</legend>
        <p className="hint mt-0">{t("intake.conditionsHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {screeningItems.filter((s) => !DERIVED.has(s.code)).map((s) => (
            <label key={s.code} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-[0.95rem]", value.conditions.includes(s.code) ? "border-brand-royal bg-brand-soft" : "border-line bg-white")}>
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-deep" checked={value.conditions.includes(s.code)} onChange={() => set("conditions", toggle(value.conditions, s.code))} name={`condition-${s.code}`} />
              {pick(s, "label")}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="intake-allergies" label={t("intake.allergies")} hint={t("intake.allergiesHint")}>
          <textarea id="intake-allergies" className="textarea" value={value.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </Field>
        <Field id="intake-skin" label={t("intake.skin")}>
          <textarea id="intake-skin" className="textarea" value={value.skinSensitivities} onChange={(e) => set("skinSensitivities", e.target.value)} />
        </Field>
        <Field id="intake-meds" label={t("intake.medications")} hint={t("intake.medicationsHint")}>
          <textarea id="intake-meds" className="textarea" value={value.medications} onChange={(e) => set("medications", e.target.value)} />
        </Field>
        <Field id="intake-injuries" label={t("intake.injuries")}>
          <textarea id="intake-injuries" className="textarea" value={value.injuries} onChange={(e) => set("injuries", e.target.value)} />
        </Field>
        <Field id="intake-surgeries" label={t("intake.surgeries")}>
          <textarea id="intake-surgeries" className="textarea" value={value.surgeries} onChange={(e) => set("surgeries", e.target.value)} />
        </Field>
        <Field id="intake-clearance" label={t("intake.clearance")} optional={t("common.optional")}>
          <textarea id="intake-clearance" className="textarea" value={value.physicianClearance} onChange={(e) => set("physicianClearance", e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <YesNo id="intake-pregnant" label={t("intake.pregnant")} value={value.pregnant} onChange={(v) => onChange({ ...value, pregnant: v, pregnancyWeeks: v ? value.pregnancyWeeks : null })} />
        {value.pregnant && (
          <Field id="intake-weeks" label={t("intake.pregnancyWeeks")}>
            <input id="intake-weeks" type="number" min={1} max={45} className="input" value={value.pregnancyWeeks ?? ""} onChange={(e) => set("pregnancyWeeks", e.target.value ? Number(e.target.value) : null)} />
          </Field>
        )}
        <YesNo id="intake-physician" label={t("intake.physician")} value={value.underPhysicianCare} onChange={(v) => set("underPhysicianCare", v)} />
        <Field id="intake-pressure-pref" label={t("intake.pressurePref")}>
          <select id="intake-pressure-pref" className="input" value={value.pressurePreference ?? ""} onChange={(e) => set("pressurePreference", (e.target.value || null) as Pressure | null)}>
            <option value="">—</option>
            {(["LIGHT", "MEDIUM", "FIRM"] as const).map((p) => <option key={p} value={p}>{t(`pressure.${p}`)}</option>)}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-2xl font-semibold text-brand-deep">{t("intake.goalsTitle")}</legend>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <label key={g} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm", value.goals.includes(g) ? "border-brand-royal bg-brand-soft text-brand-deep" : "border-line bg-white")}>
              <input type="checkbox" className="h-4 w-4 accent-brand-deep" checked={value.goals.includes(g)} onChange={() => set("goals", toggle(value.goals, g))} name={`goal-${g}`} />
              {t(`intake.goals.${g}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="intake-prefs" label={t("intake.preferences")} hint={t("intake.preferencesHint")}>
          <textarea id="intake-prefs" className="textarea" value={value.preferences} onChange={(e) => set("preferences", e.target.value)} />
        </Field>
        <div className="space-y-5">
          <Field id="intake-emergency-name" label={t("booking.emergencyName")} optional={t("common.optional")}>
            <input id="intake-emergency-name" className="input" value={value.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
          </Field>
          <Field id="intake-emergency-phone" label={t("booking.emergencyPhone")} optional={t("common.optional")}>
            <input id="intake-emergency-phone" className="input" type="tel" value={value.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
          </Field>
        </div>
      </div>
      <p className="text-sm text-ink-muted">{t("intake.noDiagnosis")}</p>
    </div>
  );
}

function YesNo({ id, label, value, onChange }: { id: string; label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex gap-2" id={id}>
        {[true, false].map((v) => (
          <label key={String(v)} className={cn("inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium", value === v ? "border-brand-royal bg-brand-soft text-brand-deep" : "border-line bg-white")}>
            <input type="radio" name={id} className="h-4 w-4 accent-brand-deep" checked={value === v} onChange={() => onChange(v)} />
            {v ? t("common.yes") : t("common.no")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Questions about this visit, with the body diagram. */
export function ConcernsForm({ value, onChange, pressureOptions }: { value: Concerns; onChange: (v: Concerns) => void; pressureOptions: Pressure[] }) {
  const { t } = useI18n();
  const set = <K extends keyof Concerns>(k: K, v: Concerns[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-6">
      <Field id="concern-bothering" label={t("intake.bothering")}>
        <textarea id="concern-bothering" className="textarea" value={value.bothering} onChange={(e) => set("bothering", e.target.value)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="concern-howlong" label={t("intake.howLong")}>
          <input id="concern-howlong" className="input" value={value.howLong} onChange={(e) => set("howLong", e.target.value)} />
        </Field>
        <fieldset>
          <legend className="label">{t("intake.pressure")}</legend>
          <div className="flex gap-2">
            {pressureOptions.map((p) => (
              <label key={p} className={cn("inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium", value.pressure === p ? "border-brand-royal bg-brand-soft text-brand-deep" : "border-line bg-white")}>
                <input type="radio" name="concern-pressure" className="h-4 w-4 accent-brand-deep" checked={value.pressure === p} onChange={() => set("pressure", p)} />
                {t(`pressure.${p}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Field id="concern-focus" label={t("intake.focus")}>
        <textarea id="concern-focus" className="textarea" value={value.focus} onChange={(e) => set("focus", e.target.value)} />
      </Field>
      <BodyDiagram value={value.areas} onChange={(areas) => set("areas", areas)} />
    </div>
  );
}
