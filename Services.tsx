import { useState } from "react";
import { api } from "@/services/api";
import type { Enhancement, Service } from "@/types";
import { useAdmin, Loadable, useAction, centsToDollars, dollarsToCents } from "./shared";

/** Services, session lengths and prices; enhancements with added time and price. */
export default function ServicesAdmin({ canEdit }: { canEdit: boolean }) {
  const state = useAdmin<{ services: Service[]; enhancements: Enhancement[] }>("admin/services");
  const { run, banner } = useAction();
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-10">
          {banner}
          {!canEdit && <p className="text-ink-muted">Only administrators can change services and prices.</p>}
          <section className="space-y-4">
            <h3 className="text-2xl">Massage services &amp; pricing</h3>
            {d.services.map((s) => <ServiceEditor key={s.id} service={s} disabled={!canEdit} onSave={(body) => run(() => api.put(`admin/services/${s.id}`, body), `${s.name_en} saved.`).then((ok) => ok && state.reload())} />)}
          </section>
          <section className="space-y-4">
            <h3 className="text-2xl">Enhancements</h3>
            <p className="text-sm text-ink-muted">Clients can add an enhancement online only after you set both its added time and price.</p>
            {d.enhancements.map((e) => <EnhancementEditor key={e.id} enhancement={e} disabled={!canEdit} onSave={(body) => run(() => api.put(`admin/enhancements/${e.id}`, body), `${e.name_en} saved.`).then((ok) => ok && state.reload())} />)}
          </section>
        </div>
      )}
    </Loadable>
  );
}

function ServiceEditor({ service, disabled, onSave }: { service: Service; disabled: boolean; onSave: (b: unknown) => void }) {
  const [f, setF] = useState({
    name_en: service.name_en, name_es: service.name_es, summary_en: service.summary_en, summary_es: service.summary_es,
    description_en: service.description_en, description_es: service.description_es,
    benefits_en: service.benefits_en.join("\n"), benefits_es: service.benefits_es.join("\n"), active: service.active, sort_order: service.sort_order,
  });
  const [durations, setDurations] = useState(service.durations.map((d) => ({ minutes: d.minutes, price: centsToDollars(d.price_cents), active: d.active })));
  return (
    <details className="card p-5" data-service-editor={service.slug}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xl font-semibold text-brand-deep">{service.name_en}</span>
        <span className="text-sm text-ink-muted">{service.durations.filter((x) => x.active).map((x) => `${x.minutes}m ${x.price_cents === null ? "(no price)" : `$${centsToDollars(x.price_cents)}`}`).join(" · ")}{service.active ? "" : " · hidden"}</span>
      </summary>
      <fieldset disabled={disabled} className="mt-5 space-y-5">
        <div>
          <p className="label">Session lengths and prices (USD)</p>
          <div className="space-y-2">
            {durations.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label="Minutes" type="number" className="input w-24" value={d.minutes} onChange={(e) => setDurations(durations.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} />
                <span className="text-sm">min</span>
                <span className="ml-2 text-sm">$</span>
                <input aria-label={`Price for ${d.minutes} minutes`} data-price={d.minutes} inputMode="decimal" className="input w-28" placeholder="not set" value={d.price} onChange={(e) => setDurations(durations.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <label className="ml-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={d.active} onChange={(e) => setDurations(durations.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />offered</label>
              </div>
            ))}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDurations([...durations, { minutes: 120, price: "", active: true }])}>+ Add a length</button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["name", "summary", "description", "benefits"] as const).flatMap((k) => (["en", "es"] as const).map((l) => {
            const key = `${k}_${l}` as keyof typeof f;
            return (
              <label key={key} className="text-sm font-medium">{k[0]!.toUpperCase() + k.slice(1)} ({l === "en" ? "English" : "Spanish"}){k === "benefits" && " — one per line"}
                {k === "name" ? <input className="input mt-1" value={f[key] as string} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
                  : <textarea className="textarea mt-1" value={f[key] as string} onChange={(e) => setF({ ...f, [key]: e.target.value })} />}
              </label>
            );
          }))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Show on website and booking</label>
          <label className="flex items-center gap-2 text-sm">Order <input type="number" className="input w-20" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></label>
        </div>
        <button type="button" className="btn-primary" onClick={() => onSave({
          ...f,
          benefits_en: f.benefits_en.split("\n").map((x) => x.trim()).filter(Boolean),
          benefits_es: f.benefits_es.split("\n").map((x) => x.trim()).filter(Boolean),
          durations: durations.map((d) => ({ minutes: d.minutes, price_cents: dollarsToCents(d.price), active: d.active })),
        })}>Save {service.name_en}</button>
      </fieldset>
    </details>
  );
}

function EnhancementEditor({ enhancement: e, disabled, onSave }: { enhancement: Enhancement; disabled: boolean; onSave: (b: unknown) => void }) {
  const [f, setF] = useState({
    name_en: e.name_en, name_es: e.name_es, description_en: e.description_en, description_es: e.description_es,
    benefits_en: e.benefits_en.join("\n"), benefits_es: e.benefits_es.join("\n"),
    minutes: e.added_minutes === null ? "" : String(e.added_minutes), price: centsToDollars(e.price_cents), active: e.active,
  });
  return (
    <details className="card p-5" data-enhancement-editor={e.slug}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xl font-semibold text-brand-deep">{e.name_en}</span>
        <span className="text-sm text-ink-muted">{e.added_minutes === null || e.price_cents === null ? "Time/price not set — not bookable" : `+${e.added_minutes} min · $${centsToDollars(e.price_cents)}`}{e.requires_qualification ? " · qualified therapists only" : ""}</span>
      </summary>
      <fieldset disabled={disabled} className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Added minutes<input data-field="minutes" type="number" min={0} className="input mt-1 w-28" value={f.minutes} onChange={(ev) => setF({ ...f, minutes: ev.target.value })} /></label>
          <label className="text-sm font-medium">Added price ($)<input data-field="price" inputMode="decimal" className="input mt-1 w-32" value={f.price} onChange={(ev) => setF({ ...f, price: ev.target.value })} /></label>
          <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={f.active} onChange={(ev) => setF({ ...f, active: ev.target.checked })} />Available</label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["name", "description", "benefits"] as const).flatMap((k) => (["en", "es"] as const).map((l) => {
            const key = `${k}_${l}` as keyof typeof f;
            return (
              <label key={key} className="text-sm font-medium">{k[0]!.toUpperCase() + k.slice(1)} ({l === "en" ? "English" : "Spanish"})
                {k === "name" ? <input className="input mt-1" value={f[key] as string} onChange={(ev) => setF({ ...f, [key]: ev.target.value })} />
                  : <textarea className="textarea mt-1" value={f[key] as string} onChange={(ev) => setF({ ...f, [key]: ev.target.value })} />}
              </label>
            );
          }))}
        </div>
        <button type="button" className="btn-primary" onClick={() => onSave({
          name_en: f.name_en, name_es: f.name_es, description_en: f.description_en, description_es: f.description_es,
          benefits_en: f.benefits_en.split("\n").map((x) => x.trim()).filter(Boolean), benefits_es: f.benefits_es.split("\n").map((x) => x.trim()).filter(Boolean),
          added_minutes: f.minutes === "" ? null : Number(f.minutes), price_cents: dollarsToCents(f.price), active: f.active,
        })}>Save {e.name_en}</button>
      </fieldset>
    </details>
  );
}
