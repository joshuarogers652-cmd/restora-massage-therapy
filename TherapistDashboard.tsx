import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarDays, ClipboardList, FileText } from "lucide-react";
import { SOAPForm } from "@/components/SOAPForm";
import { Alert, Field, Spinner, StatusBadge } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { api, ApiError } from "@/services/api";
import type { Category, Concerns, Intake, SoapContent } from "@/types";
import { cn } from "@/utils/format";

// Staff screens are in English. Client-facing screens are bilingual.
type Row = {
  id: string; starts_at: string; ends_at: string; status: string; flagged_count: number; first_name: string; last_name: string;
  preferred_name: string | null; service_name_en: string; minutes: number; enhancements: string[]; intake_complete: boolean;
  soap_status: string | null; last_review: string | null;
};
type Detail = {
  appointment: Record<string, unknown> & { id: string; status: string; starts_at: string; first_name: string; last_name: string; service_name_en: string; minutes: number; enhancements: { slug: string; name_en: string }[]; phone: string | null; email: string | null; date_of_birth: string | null; pressure: string | null };
  intake: Intake | null;
  concerns: Concerns | null;
  flags: { code: string; category: Category; source: string }[];
  reviews: { id: string; decision: string; rationale: string; createdAt: string; reviewer: string | null }[];
  history: { appointmentId: string; startsAt: string; service: string; therapist: string; signedAt: string; content: SoapContent }[];
  soap: null | { status: "DRAFT" | "SIGNED"; content: SoapContent; signedAt: string | null; signatureName: string | null; amendmentCount: number };
  consents: { kind: string; signed_name: string; signed_at: string }[];
};

const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(new Date(iso));
const CAT_LABEL: Record<Category, string> = { POSTPONE_OR_REFER: "Postpone or refer", MODIFY_TREATMENT: "Modify treatment", CLEARANCE_REQUIRED: "Assessment or medical clearance" };

export default function TherapistDashboard() {
  const { catalog } = useCatalog();
  const tz = catalog?.settings.business.timezone ?? "America/Chicago";
  const [data, setData] = useState<{ appointments: Row[]; outstandingSoap: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 21 * 86400000);
    api
      .get<{ appointments: Row[]; outstandingSoap: Row[] }>(`therapist/schedule?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the schedule."));
  }, []);
  useEffect(load, [load]);

  if (openId) return <AppointmentView id={openId} tz={tz} onBack={() => { setOpenId(null); load(); }} />;
  if (error) return <div className="container-page py-12"><Alert tone="error">{error}</Alert></div>;
  if (!data) return <Spinner label="Loading…" />;

  const todayKey = fmt(new Date().toISOString(), tz, { dateStyle: "short" });
  const today = data.appointments.filter((a) => fmt(a.starts_at, tz, { dateStyle: "short" }) === todayKey);
  const upcoming = data.appointments.filter((a) => !today.includes(a) && new Date(a.starts_at) > new Date());
  const pendingReview = data.appointments.filter((a) => a.status === "PENDING_REVIEW");

  const list = (rows: Row[], empty: string) =>
    rows.length ? (
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpenId(a.id)} className="card flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:shadow-lift" data-appointment={a.id}>
              <div className="min-w-0">
                <p className="font-semibold text-ink">{fmt(a.starts_at, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {a.preferred_name || a.first_name} {a.last_name}</p>
                <p className="text-sm text-ink-muted">{a.service_name_en} · {a.minutes} min{a.enhancements.length ? ` · ${a.enhancements.join(", ")}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.flagged_count > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-caution-bg px-2.5 py-1 text-xs font-semibold text-caution-ink"><AlertTriangle className="h-3.5 w-3.5" />{a.flagged_count} flag{a.flagged_count > 1 ? "s" : ""}</span>}
                {!a.intake_complete && <span className="chip">No intake</span>}
                <StatusBadge status={a.status} label={a.status.replace(/_/g, " ").toLowerCase()} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-ink-muted">{empty}</p>
    );

  return (
    <div className="container-page space-y-10 py-10 sm:py-14">
      <div>
        <p className="eyebrow">Therapist</p>
        <h1 className="text-4xl">Your schedule</h1>
      </div>
      {pendingReview.length > 0 && <Alert tone="warning">{pendingReview.length} appointment(s) need your health review before they can be confirmed.</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarDays} label="Today" value={today.length} />
        <Stat icon={AlertTriangle} label="Waiting for review" value={pendingReview.length} />
        <Stat icon={FileText} label="SOAP notes outstanding" value={data.outstandingSoap.length} />
      </div>
      <section className="space-y-3"><h2 className="text-2xl">Today</h2>{list(today, "No appointments today.")}</section>
      <section className="space-y-3"><h2 className="text-2xl">Upcoming (next 3 weeks)</h2>{list(upcoming, "No upcoming appointments.")}</section>
      <section className="space-y-3"><h2 className="text-2xl">Outstanding SOAP notes</h2>{list(data.outstandingSoap, "All SOAP notes are signed.")}</section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep"><Icon className="h-5 w-5" /></span>
      <div><p className="font-display text-3xl font-semibold text-brand-deep">{value}</p><p className="text-sm text-ink-muted">{label}</p></div>
    </div>
  );
}

function AppointmentView({ id, tz, onBack }: { id: string; tz: string; onBack: () => void }) {
  const { catalog } = useCatalog();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState("PROCEED");
  const [rationale, setRationale] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => {
    api.get<Detail>(`therapist/appointments/${id}`).then(setD).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
  }, [id]);
  useEffect(load, [load, version]);
  const label = (code: string) => catalog?.screeningItems.find((s) => s.code === code)?.label_en ?? code;

  if (error) return <div className="container-page py-12"><Alert tone="error">{error}</Alert></div>;
  if (!d) return <Spinner label="Loading…" />;
  const a = d.appointment;

  async function act(path: string, body: unknown, ok: string) {
    try {
      await api.post(`therapist/appointments/${id}/${path}`, body);
      setMsg({ tone: "success", text: ok });
      setVersion((v) => v + 1);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
    }
  }

  return (
    <div className="container-page space-y-8 py-10">
      <button type="button" className="btn-ghost -ml-3" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back to schedule</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">{String(a.preferred_name || a.first_name)} {a.last_name}</h1>
          <p className="mt-1 text-lg">{a.service_name_en} · {a.minutes} min · {fmt(a.starts_at, tz, { dateStyle: "full", timeStyle: "short" })}</p>
          {a.enhancements.length > 0 && <p className="text-ink-muted">Enhancements: {a.enhancements.map((e) => e.name_en).join(", ")}</p>}
        </div>
        <StatusBadge status={a.status} label={a.status.replace(/_/g, " ").toLowerCase()} />
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {d.flags.length > 0 && (
        <section className="card space-y-4 border-caution-ink/30 p-6">
          <h2 className="flex items-center gap-2 text-2xl"><AlertTriangle className="h-6 w-6 text-caution-ink" />Contraindication flags</h2>
          <p className="text-sm text-ink-muted">Flags come from the client's answers. The software does not decide whether treatment is safe; your review does.</p>
          <ul className="space-y-2">
            {d.flags.map((f) => (
              <li key={f.code + f.source} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-caution-bg/60 px-4 py-3">
                <span className="font-medium">{label(f.code)} <span className="text-sm font-normal text-ink-muted">({f.source})</span></span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", f.category === "POSTPONE_OR_REFER" ? "bg-stop-bg text-stop-ink" : f.category === "CLEARANCE_REQUIRED" ? "bg-caution-bg text-caution-ink" : "bg-brand-soft text-brand-deep")}>{CAT_LABEL[f.category]}</span>
              </li>
            ))}
          </ul>
          {d.reviews.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-sans text-sm font-semibold">Review history</h3>
              {d.reviews.map((r) => <p key={r.id} className="text-sm"><span className="font-semibold">{r.decision.replace(/_/g, " ").toLowerCase()}</span> · {new Date(r.createdAt).toLocaleString()} · {r.reviewer ?? ""}<br /><span className="text-ink-muted">{r.rationale}</span></p>)}
            </div>
          )}
          {a.status === "PENDING_REVIEW" && (
            <div className="space-y-4 rounded-xl border border-line p-4">
              <h3 className="font-sans text-base font-semibold">Record your review (required before confirming)</h3>
              <Field id="rev-decision" label="Decision">
                <select id="rev-decision" className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
                  <option value="PROCEED">Proceed as booked</option>
                  <option value="PROCEED_WITH_MODIFICATIONS">Proceed with modifications</option>
                  <option value="CLEARANCE_REQUESTED">Request assessment or medical clearance (stays pending)</option>
                  <option value="POSTPONE">Postpone (cancels and refunds)</option>
                  <option value="REFER">Refer for evaluation (cancels and refunds)</option>
                </select>
              </Field>
              <Field id="rev-rationale" label="Rationale" hint="Required. Kept encrypted in the client's record.">
                <textarea id="rev-rationale" className="textarea" value={rationale} onChange={(e) => setRationale(e.target.value)} />
              </Field>
              <button type="button" className="btn-primary" disabled={rationale.trim().length < 10} onClick={() => void act("review", { decision, rationale }, "Review recorded.")}>Save review</button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {a.status === "CONFIRMED" && <button type="button" className="btn-secondary" onClick={() => void act("status", { status: "CHECKED_IN" }, "Checked in.")}>Check in</button>}
        {["CONFIRMED", "CHECKED_IN"].includes(a.status) && <button type="button" className="btn-primary" onClick={() => void act("status", { status: "COMPLETED" }, "Session completed.")}>Mark completed</button>}
        {a.status === "CONFIRMED" && <button type="button" className="btn-danger" onClick={() => void act("status", { status: "NO_SHOW" }, "Marked as no-show.")}>No-show</button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-2xl"><ClipboardList className="h-6 w-6 text-brand-royal" />This visit</h2>
          {d.concerns ? (
            <dl className="space-y-3 text-[0.95rem]">
              <Item label="Areas of concern" value={d.concerns.areas.map((x) => x.replace("_", " ")).join(", ") || "—"} />
              <Item label="What is bothering them" value={d.concerns.bothering} />
              <Item label="How long" value={d.concerns.howLong} />
              <Item label="Focus requested" value={d.concerns.focus} />
              <Item label="Pressure preferred" value={d.concerns.pressure.toLowerCase()} />
            </dl>
          ) : <p className="text-ink-muted">No visit answers.</p>}
          <h3 className="pt-2 font-sans text-sm font-semibold">Consents signed</h3>
          <p className="text-sm text-ink-muted">{d.consents.map((c) => `${c.kind.replace(/_/g, " ").toLowerCase()} (${c.signed_name})`).join(" · ") || "None"}</p>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-2xl">Health history</h2>
          {d.intake ? (
            <dl className="space-y-3 text-[0.95rem]">
              <Item label="Reported conditions" value={d.intake.conditions.map(label).join(", ") || "None selected"} />
              <Item label="Allergies" value={d.intake.allergies} />
              <Item label="Skin sensitivities" value={d.intake.skinSensitivities} />
              <Item label="Medications" value={d.intake.medications} />
              <Item label="Injuries" value={d.intake.injuries} />
              <Item label="Surgeries" value={d.intake.surgeries} />
              <Item label="Pregnant" value={d.intake.pregnant === null ? "—" : d.intake.pregnant ? `Yes${d.intake.pregnancyWeeks ? `, ${d.intake.pregnancyWeeks} weeks` : ""}` : "No"} />
              <Item label="Under a doctor's care" value={d.intake.underPhysicianCare === null ? "—" : d.intake.underPhysicianCare ? "Yes" : "No"} />
              <Item label="Provider clearance / instructions" value={d.intake.physicianClearance} />
              <Item label="Goals" value={d.intake.goals.join(", ")} />
              <Item label="Preferences" value={d.intake.preferences} />
              <Item label="Emergency contact" value={[d.intake.emergencyName, d.intake.emergencyPhone].filter(Boolean).join(" · ")} />
            </dl>
          ) : <p className="text-ink-muted">No intake on file.</p>}
        </section>
      </div>

      {d.history.length > 0 && (
        <section className="card space-y-3 p-6">
          <h2 className="text-2xl">Previous treatment plans</h2>
          {d.history.map((h) => (
            <details key={h.appointmentId} className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer font-medium">{new Date(h.startsAt).toLocaleDateString()} · {h.service} · {h.therapist}</summary>
              <dl className="mt-3 space-y-2 text-sm">
                <Item label="Plan — next focus" value={h.content.plan.nextFocus} />
                <Item label="Plan — interval" value={h.content.plan.interval} />
                <Item label="Plan — self-care" value={h.content.plan.selfCare} />
                <Item label="Assessment — progress" value={h.content.assessment.progress} />
              </dl>
            </details>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-3xl">SOAP note</h2>
        <SOAPForm
          key={`${version}-${d.soap?.status ?? "none"}-${d.soap?.amendmentCount ?? 0}`}
          appointmentId={id}
          status={a.status}
          initial={d.soap}
          previous={d.history[0] ? { startsAt: d.history[0].startsAt, service: d.history[0].service, therapist: d.history[0].therapist, content: d.history[0].content } : null}
          hasCupping={a.enhancements.some((e) => e.slug === "dynamic-cupping")}
          onSaved={() => setVersion((v) => v + 1)}
        />
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{value && value.trim() ? value : "—"}</dd>
    </div>
  );
}
