import { useEffect, useRef, useState } from "react";
import { CheckCircle2, History, PenLine } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { Alert, Field } from "@/components/ui";
import type { SoapContent } from "@/types";
import { BODY_AREAS } from "@/types";
import { cn } from "@/utils/format";

export const emptySoap = (): SoapContent => ({
  subjective: { concerns: "", symptoms: "", goals: "", changes: "", healthUpdates: "" },
  objective: { observations: "", areasTreated: [], techniques: "", pressure: null, durationMinutes: null, clientResponse: "", enhancementsPerformed: "", cuppingAreas: "", productsUsed: "Standard hypoallergenic lotion" },
  assessment: { tolerance: "", progress: "", observedChanges: "", limitations: "", followUp: "" },
  plan: { nextFocus: "", interval: "", selfCare: "", referrals: "" },
});

type Template = { id: string; name: string; body: Record<"subjective" | "objective" | "assessment" | "plan", string> };
type Props = {
  appointmentId: string;
  status: string; // appointment status
  initial: { status: "DRAFT" | "SIGNED"; content: SoapContent; signedAt: string | null; signatureName: string | null; amendmentCount: number } | null;
  previous: { startsAt: string; service: string; therapist: string; content: SoapContent } | null;
  hasCupping: boolean;
  onSaved: () => void;
};

const LABELS: Record<string, string> = {
  concerns: "Client-reported concerns", symptoms: "Symptoms and description", goals: "Client goals", changes: "Changes since last visit", healthUpdates: "Health history updates",
  observations: "Therapist observations", techniques: "Techniques used", clientResponse: "Client response", enhancementsPerformed: "Enhancements performed", cuppingAreas: "Cupping treatment areas", productsUsed: "Products used",
  tolerance: "Client tolerance", progress: "Progress toward goals", observedChanges: "Observed changes", limitations: "Treatment limitations", followUp: "Concerns needing follow-up",
  nextFocus: "Focus for future sessions", interval: "Suggested appointment interval", selfCare: "Self-care guidance", referrals: "Referrals (if indicated)",
};
const SECTIONS = [
  { key: "subjective", letter: "S", title: "Subjective", fields: ["concerns", "symptoms", "goals", "changes", "healthUpdates"] },
  { key: "objective", letter: "O", title: "Objective", fields: ["observations", "techniques", "clientResponse", "enhancementsPerformed", "cuppingAreas", "productsUsed"] },
  { key: "assessment", letter: "A", title: "Assessment", fields: ["tolerance", "progress", "observedChanges", "limitations", "followUp"] },
  { key: "plan", letter: "P", title: "Plan", fields: ["nextFocus", "interval", "selfCare", "referrals"] },
] as const;

/** SOAP documentation (staff screen, English). Drafts autosave; signed notes change only by amendment. */
export function SOAPForm({ appointmentId, status, initial, previous, hasCupping, onSaved }: Props) {
  const [content, setContent] = useState<SoapContent>(initial?.content ?? emptySoap());
  const [noteStatus, setNoteStatus] = useState<"NONE" | "DRAFT" | "SIGNED">(initial?.status ?? "NONE");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState("");
  const [compare, setCompare] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const timer = useRef<number | null>(null);
  const editable = (noteStatus !== "SIGNED" || amending) && ["CHECKED_IN", "COMPLETED"].includes(status);

  useEffect(() => {
    api.get<{ templates: Template[] }>("therapist/soap-templates").then((r) => setTemplates(r.templates)).catch(() => undefined);
  }, []);
  const hints = templates[0]?.body;

  // Autosave drafts 2 seconds after the last change.
  useEffect(() => {
    if (!dirty || noteStatus === "SIGNED") return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveDraft(), 2000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [content, dirty]);

  async function saveDraft() {
    try {
      const r = await api.put<{ draftSavedAt: string }>(`therapist/appointments/${appointmentId}/soap`, content);
      setSavedAt(r.draftSavedAt);
      setNoteStatus("DRAFT");
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the draft.");
    }
  }

  async function sign() {
    try {
      await api.post(`therapist/appointments/${appointmentId}/soap/sign`, { signatureName: signature, content });
      setNoteStatus("SIGNED");
      setDirty(false);
      setError(null);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not sign the note.");
    }
  }

  async function amend() {
    try {
      await api.post(`therapist/appointments/${appointmentId}/soap/amend`, { reason, content });
      setAmending(false);
      setReason("");
      setError(null);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the amendment.");
    }
  }

  const update = (section: keyof SoapContent, field: string, v: unknown) => {
    setContent((c) => ({ ...c, [section]: { ...c[section], [field]: v } }));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {noteStatus === "SIGNED" ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-go-ink"><CheckCircle2 className="h-4 w-4" />Signed{initial?.signedAt ? ` ${new Date(initial.signedAt).toLocaleString()}` : ""}{initial?.signatureName ? ` by ${initial.signatureName}` : ""}{initial && initial.amendmentCount > 0 ? ` · ${initial.amendmentCount} amendment(s)` : ""}</span>
          ) : (
            <span className="text-ink-muted" aria-live="polite">{dirty ? "Unsaved changes…" : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : noteStatus === "DRAFT" ? "Draft" : "Not started"}</span>
          )}
        </div>
        {previous && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setCompare((v) => !v)} aria-pressed={compare}>
            <History className="h-4 w-4" /> {compare ? "Hide previous session" : "Compare with previous session"}
          </button>
        )}
      </div>
      {!["CHECKED_IN", "COMPLETED"].includes(status) && <Alert tone="info">Check the client in to start the SOAP note.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {SECTIONS.map((sec) => (
        <section key={sec.key} className="card overflow-hidden shadow-none">
          <h3 className="flex items-center gap-3 border-b border-line bg-brand-lilac px-5 py-3 font-sans text-base font-semibold text-brand-deep">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-deep font-display text-lg text-white">{sec.letter}</span>
            {sec.title}
          </h3>
          <div className={cn("grid gap-5 p-5", compare && previous && "lg:grid-cols-2")}>
            <div className="space-y-4">
              {hints && <p className="text-sm text-ink-muted">{hints[sec.key]}</p>}
              {sec.key === "objective" && (
                <>
                  <fieldset>
                    <legend className="label">Areas treated</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {BODY_AREAS.map((a) => (
                        <label key={a} className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs", content.objective.areasTreated.includes(a) ? "border-brand-royal bg-brand-soft" : "border-line")}>
                          <input type="checkbox" disabled={!editable} className="accent-brand-deep" checked={content.objective.areasTreated.includes(a)}
                            onChange={() => update("objective", "areasTreated", content.objective.areasTreated.includes(a) ? content.objective.areasTreated.filter((x) => x !== a) : [...content.objective.areasTreated, a])} />
                          {a.replace("_", " ")}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="soap-pressure" label="Pressure used">
                      <select id="soap-pressure" className="input" disabled={!editable} value={content.objective.pressure ?? ""} onChange={(e) => update("objective", "pressure", e.target.value || null)}>
                        <option value="">—</option><option value="LIGHT">Light</option><option value="MEDIUM">Medium</option><option value="FIRM">Firm</option>
                      </select>
                    </Field>
                    <Field id="soap-duration" label="Session length (minutes)">
                      <input id="soap-duration" type="number" min={0} max={300} className="input" disabled={!editable} value={content.objective.durationMinutes ?? ""} onChange={(e) => update("objective", "durationMinutes", e.target.value ? Number(e.target.value) : null)} />
                    </Field>
                  </div>
                </>
              )}
              {sec.fields
                .filter((f) => f !== "cuppingAreas" || hasCupping)
                .map((f) => (
                  <Field key={f} id={`soap-${sec.key}-${f}`} label={LABELS[f]!}>
                    <textarea
                      id={`soap-${sec.key}-${f}`}
                      className="textarea min-h-20"
                      disabled={!editable}
                      value={(content[sec.key] as Record<string, unknown>)[f] as string}
                      onChange={(e) => update(sec.key, f, e.target.value)}
                    />
                  </Field>
                ))}
            </div>
            {compare && previous && (
              <aside className="rounded-xl bg-brand-lilac p-4 text-sm" aria-label="Previous session">
                <p className="mb-2 font-semibold text-brand-deep">Previous: {new Date(previous.startsAt).toLocaleDateString()} · {previous.service}</p>
                <dl className="space-y-2">
                  {Object.entries(previous.content[sec.key] as Record<string, unknown>)
                    .filter(([, v]) => (Array.isArray(v) ? v.length : v))
                    .map(([k, v]) => (
                      <div key={k}><dt className="font-medium text-ink-muted">{LABELS[k] ?? k}</dt><dd className="whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>
                    ))}
                </dl>
              </aside>
            )}
          </div>
        </section>
      ))}

      {noteStatus !== "SIGNED" ? (
        <div className="card space-y-4 p-5">
          <p className="text-sm text-ink-muted">Record only what the client reported and what you observed and did. Signing locks the note; later changes are kept as amendments.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field id="soap-signature" label="Type your full name to sign">
                <input id="soap-signature" className="input" value={signature} onChange={(e) => setSignature(e.target.value)} />
              </Field>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void saveDraft()} disabled={!editable}>Save draft</button>
            <button type="button" className="btn-primary" onClick={() => void sign()} disabled={status !== "COMPLETED" || signature.trim().length < 2}>
              <PenLine className="h-4 w-4" /> Sign note
            </button>
          </div>
          {status !== "COMPLETED" && <p className="text-sm text-ink-muted">Mark the session completed to sign.</p>}
        </div>
      ) : amending ? (
        <div className="card space-y-4 p-5">
          <Field id="soap-amend-reason" label="Reason for amendment">
            <input id="soap-amend-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={reason.trim().length < 5} onClick={() => void amend()}>Save amendment</button>
            <button type="button" className="btn-ghost" onClick={() => { setAmending(false); setContent(initial?.content ?? content); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setAmending(true)}>Add an amendment</button>
      )}
    </div>
  );
}
