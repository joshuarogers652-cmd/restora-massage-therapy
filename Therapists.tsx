import { useState } from "react";
import { api } from "@/services/api";
import type { Enhancement, Service } from "@/types";
import { hhmmToMinutes, minutesToHHMM } from "@/utils/format";
import { useAdmin, Loadable, useAction } from "./shared";

type T = {
  id: string; display_name: string; invite_email: string | null; user_email: string | null; user_id: string | null; bio_en: string | null; bio_es: string | null;
  license_number: string | null; license_expires_on: string | null; active: boolean; accepts_new_clients: boolean; service_ids: string[];
  enhancements: { enhancement_id: string; certification: string | null }[]; hours: { weekday: number; start_minute: number; end_minute: number }[];
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TherapistsAdmin({ canEdit }: { canEdit: boolean }) {
  const state = useAdmin<{ therapists: T[] }>("admin/therapists");
  const catalog = useAdmin<{ services: Service[]; enhancements: Enhancement[] }>("admin/services");
  const { run, banner } = useAction();
  const [adding, setAdding] = useState(false);
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-5">
          {banner}
          <p className="text-sm text-ink-muted">Add a therapist with the email address they will sign in with. Their profile links automatically the first time they sign in. Only qualified therapists can be booked for a service or enhancement.</p>
          {canEdit && !adding && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Add therapist</button>}
          {adding && catalog.data && (
            <TherapistForm services={catalog.data.services} enhancements={catalog.data.enhancements} onCancel={() => setAdding(false)}
              onSave={async (b) => { if (await run(() => api.post("admin/therapists", b), "Therapist added.")) { setAdding(false); state.reload(); } }} />
          )}
          {d.therapists.length === 0 && !adding && <p>No therapists yet.</p>}
          {d.therapists.map((th) => (
            <details key={th.id} className="card p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xl font-semibold text-brand-deep">{th.display_name}</span>
                <span className="text-sm text-ink-muted">{th.user_id ? `Signed in as ${th.user_email}` : `Invited: ${th.invite_email} (not signed in yet)`}{th.active ? "" : " · inactive"}{th.license_expires_on && new Date(th.license_expires_on) < new Date(Date.now() + 60 * 86400000) ? ` · license expires ${th.license_expires_on}` : ""}</span>
              </summary>
              {catalog.data && <div className="mt-5"><TherapistForm existing={th} disabled={!canEdit} services={catalog.data.services} enhancements={catalog.data.enhancements}
                onSave={async (b) => { if (await run(() => api.put(`admin/therapists/${th.id}`, b), "Therapist saved.")) state.reload(); }} /></div>}
            </details>
          ))}
        </div>
      )}
    </Loadable>
  );
}

function TherapistForm({ existing, services, enhancements, onSave, onCancel, disabled }: { existing?: T; services: Service[]; enhancements: Enhancement[]; onSave: (b: unknown) => void; onCancel?: () => void; disabled?: boolean }) {
  const [f, setF] = useState({
    inviteEmail: existing?.invite_email ?? existing?.user_email ?? "", displayName: existing?.display_name ?? "", bio_en: existing?.bio_en ?? "", bio_es: existing?.bio_es ?? "",
    licenseNumber: existing?.license_number ?? "", licenseExpiresOn: existing?.license_expires_on ?? "", active: existing?.active ?? true, acceptsNewClients: existing?.accepts_new_clients ?? true,
  });
  const [serviceIds, setServiceIds] = useState<string[]>(existing?.service_ids ?? services.map((s) => s.id));
  const [enh, setEnh] = useState<Record<string, string | null>>(Object.fromEntries((existing?.enhancements ?? []).map((e) => [e.enhancement_id, e.certification])));
  const [hours, setHours] = useState(existing?.hours.map((h) => ({ weekday: h.weekday, start: minutesToHHMM(h.start_minute), end: minutesToHHMM(h.end_minute) })) ?? [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start: "09:00", end: "17:00" })));
  return (
    <fieldset disabled={disabled} className="space-y-5" data-therapist-form={existing?.id ?? "new"}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Sign-in email<input name="inviteEmail" type="email" className="input mt-1" value={f.inviteEmail} onChange={(e) => setF({ ...f, inviteEmail: e.target.value })} /></label>
        <label className="text-sm font-medium">Display name<input name="displayName" className="input mt-1" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>
        <label className="text-sm font-medium">License number<input className="input mt-1" value={f.licenseNumber} onChange={(e) => setF({ ...f, licenseNumber: e.target.value })} /></label>
        <label className="text-sm font-medium">License expires<input type="date" className="input mt-1" value={f.licenseExpiresOn} onChange={(e) => setF({ ...f, licenseExpiresOn: e.target.value })} /></label>
        <label className="text-sm font-medium">Bio (English)<textarea className="textarea mt-1" value={f.bio_en} onChange={(e) => setF({ ...f, bio_en: e.target.value })} /></label>
        <label className="text-sm font-medium">Bio (Spanish)<textarea className="textarea mt-1" value={f.bio_es} onChange={(e) => setF({ ...f, bio_es: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-deep" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Active</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-deep" checked={f.acceptsNewClients} onChange={(e) => setF({ ...f, acceptsNewClients: e.target.checked })} />Accepts new clients</label>
      </div>
      <div>
        <p className="label">Qualified services</p>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
              <input type="checkbox" className="accent-brand-deep" checked={serviceIds.includes(s.id)} onChange={() => setServiceIds(serviceIds.includes(s.id) ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])} />{s.name_en}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Enhancement qualifications</p>
        <div className="space-y-2">
          {enhancements.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-deep" data-qualify={e.slug} checked={e.id in enh} onChange={() => { const n = { ...enh }; if (e.id in n) delete n[e.id]; else n[e.id] = null; setEnh(n); }} />{e.name_en}{e.requires_qualification ? " (certification required)" : ""}</label>
              {e.id in enh && e.requires_qualification && <input className="input w-64" placeholder="Certification name" value={enh[e.id] ?? ""} onChange={(ev) => setEnh({ ...enh, [e.id]: ev.target.value })} />}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Weekly working hours</p>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <select className="input w-24" value={h.weekday} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))}>{DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}</select>
              <input type="time" className="input w-32" value={h.start} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />–
              <input type="time" className="input w-32" value={h.end} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
              <button type="button" className="btn-ghost btn-sm" onClick={() => setHours(hours.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setHours([...hours, { weekday: 6, start: "10:00", end: "14:00" }])}>+ Add hours</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => onSave({
          ...f, bio_en: f.bio_en || null, bio_es: f.bio_es || null, licenseNumber: f.licenseNumber || null, licenseExpiresOn: f.licenseExpiresOn || null,
          serviceIds, enhancements: Object.entries(enh).map(([enhancementId, certification]) => ({ enhancementId, certification: certification || null })),
          hours: hours.map((h) => ({ weekday: h.weekday, startMinute: hhmmToMinutes(h.start), endMinute: hhmmToMinutes(h.end) })),
        })}>Save therapist</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </fieldset>
  );
}
