import { useState, type FormEvent } from "react";
import { Clock, Mail, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { Alert, Field, SectionHeading } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import { api, ApiError } from "@/services/api";

/** Contact details, hours and map link — all editable in Admin › Settings. */
export function ContactDetails() {
  const { t, tl, pick } = useI18n();
  const { catalog } = useCatalog();
  if (!catalog) return null;
  const b = catalog.settings.business;
  const days = tl<string[]>("contact.days");
  const hoursSet = Object.keys(b.hours ?? {}).length > 0;
  const soon = <span className="text-ink-muted">{t("common.comingSoon")}</span>;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <dl className="card space-y-4 p-6">
        <div className="flex gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-royal" aria-hidden /><div><dt className="text-sm text-ink-muted">{t("contact.phone")}</dt><dd>{b.phone ? <a className="font-medium text-brand-deep hover:underline" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a> : soon}</dd></div></div>
        <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-royal" aria-hidden /><div><dt className="text-sm text-ink-muted">{t("contact.email")}</dt><dd>{b.email ? <a className="font-medium text-brand-deep hover:underline" href={`mailto:${b.email}`}>{b.email}</a> : soon}</dd></div></div>
        <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-royal" aria-hidden /><div><dt className="text-sm text-ink-muted">{t("contact.location")}</dt><dd>{b.address ?? pick(b as unknown as Record<string, unknown>, "area")}</dd></div></div>
      </dl>
      <div className="card space-y-3 p-6">
        <h3 className="flex items-center gap-2 font-sans text-base font-semibold text-ink"><Clock className="h-5 w-5 text-brand-royal" aria-hidden />{t("contact.hours")}</h3>
        {hoursSet ? (
          <ul className="space-y-1.5 text-[0.95rem]">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = b.hours[String(d)];
              return <li key={d} className="flex justify-between gap-4"><span>{days[d]}</span><span className="tabular-nums text-ink-muted">{h ? `${h.open} – ${h.close}` : t("contact.closed")}</span></li>;
            })}
          </ul>
        ) : soon}
        <div className="mt-2 rounded-xl border border-dashed border-line p-4 text-center text-sm">
          <p className="font-medium text-ink">{t("contact.map")}</p>
          {b.mapUrl ? <a href={b.mapUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm mt-2">{t("contact.openMap")}</a> : <p className="text-ink-muted">{t("common.comingSoon")}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Contact() {
  const { t, locale } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: "booking", message: "", consent: false, company: "" });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [apiError, setApiError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      name: !form.name.trim(),
      email: !/^\S+@\S+\.\S+$/.test(form.email),
      message: form.message.trim().length < 10,
      consent: !form.consent,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setState("sending");
    setApiError(null);
    try {
      await api.post("contact", { ...form, phone: form.phone || null, locale, company: form.company || undefined });
      setState("sent");
    } catch (err) {
      setState("idle");
      setApiError(err instanceof ApiError && t(`errors.${err.code}`) !== `errors.${err.code}` ? t(`errors.${err.code}`) : t("common.error"));
    }
  }
  const msg = (k: string) => (errors[k] ? t("errors.VALIDATION") : undefined);

  return (
    <div className="container-page space-y-12 py-14 sm:py-20">
      <SectionHeading as="h1" eyebrow={t("contact.eyebrow")} title={t("contact.title")} lead={t("contact.lead")} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="card p-6 sm:p-8">
          {state === "sent" ? (
            <div role="status" className="flex gap-3 text-brand-deep"><CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden /><p className="text-lg">{t("contact.form.sent")}</p></div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              {apiError && <Alert tone="error">{apiError}</Alert>}
              <div className="hidden" aria-hidden><label>Company<input tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="c-name" label={t("contact.form.name")} error={msg("name")}><input id="c-name" className="input" autoComplete="name" aria-invalid={errors.name || undefined} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field id="c-email" label={t("contact.form.email")} error={msg("email")}><input id="c-email" className="input" type="email" autoComplete="email" aria-invalid={errors.email || undefined} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field id="c-phone" label={t("contact.form.phone")} optional={t("common.optional")}><input id="c-phone" className="input" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field id="c-topic" label={t("contact.form.topic")}>
                  <select id="c-topic" className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                    {(["booking", "services", "other"] as const).map((k) => <option key={k} value={k}>{t(`contact.form.topics.${k}`)}</option>)}
                  </select>
                </Field>
              </div>
              <Field id="c-message" label={t("contact.form.message")} hint={t("contact.form.hint")} error={msg("message")}>
                <textarea id="c-message" className="textarea" aria-invalid={errors.message || undefined} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </Field>
              <label className="flex min-h-11 items-start gap-3 text-[0.95rem]">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-deep" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} aria-invalid={errors.consent || undefined} />
                {t("contact.form.consent")}
              </label>
              {errors.consent && <p role="alert" className="text-sm text-stop-ink">{t("errors.VALIDATION")}</p>}
              <button type="submit" className="btn-primary btn-lg w-full sm:w-auto" disabled={state === "sending"}>{state === "sending" ? t("contact.form.sending") : t("contact.form.submit")}</button>
            </form>
          )}
        </div>
        <div className="space-y-6">
          <h2 className="text-2xl">{t("contact.details")}</h2>
          <ContactDetails />
        </div>
      </div>
    </div>
  );
}
