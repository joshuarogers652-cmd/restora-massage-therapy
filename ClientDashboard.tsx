import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, ExternalLink } from "lucide-react";
import { BookingCalendar } from "@/components/BookingCalendar";
import { IntakeForm } from "@/components/IntakeForm";
import { Alert, Field, Spinner, StatusBadge } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import { api, ApiError } from "@/services/api";
import type { Slot } from "@/services/booking";
import { emptyIntake, type Intake, type Locale } from "@/types";
import { cn, dateTime, money } from "@/utils/format";

type Appt = {
  id: string; starts_at: string; status: string; total_cents: number; minutes: number; service_id: string; therapist_id: string;
  enhancement_ids: string[]; service_name_en: string; service_name_es: string; therapist_name: string; payment_status: string | null;
  enhancements: { name_en: string; name_es: string }[];
};
const TABS = ["appointments", "profile", "intake", "consents", "receipts", "preferences", "records"] as const;
type Tab = (typeof TABS)[number];

export default function ClientDashboard() {
  const { t } = useI18n();
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : me?.client ? "appointments" : "profile";
  const name = me?.client?.preferred_name || me?.client?.first_name || me?.user.email || "";

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-4xl">{t("account.title")}</h1>
      <p className="mt-2 text-ink-muted">{t("account.welcome", { name })}</p>
      {!me?.client && <Alert tone="info" className="mt-6">{t("account.completeProfile")}</Alert>}
      <div className="mt-8 flex gap-1.5 overflow-x-auto border-b border-line pb-px" role="tablist">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}
            className={cn("shrink-0 rounded-t-xl px-4 py-2.5 text-sm font-medium", tab === k ? "border-b-2 border-brand-deep text-brand-deep" : "text-ink-muted hover:text-brand-deep")}>
            {t(`account.tabs.${k}`)}
          </button>
        ))}
      </div>
      <div className="pt-8" role="tabpanel">
        {tab === "appointments" && <Appointments />}
        {tab === "profile" && <ProfileTab />}
        {tab === "intake" && <IntakeTab />}
        {tab === "consents" && <ConsentsTab />}
        {tab === "receipts" && <ReceiptsTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "records" && <RecordsTab />}
      </div>
    </div>
  );
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get<T>(path).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Error"));
  useEffect(() => {
    void reload();
  }, [path]);
  return { data, error, reload };
}

function Appointments() {
  const { t, locale } = useI18n();
  const { catalog } = useCatalog();
  const { data, error, reload } = useLoad<{ appointments: Appt[] }>("me/appointments");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || !catalog) return <Spinner label={t("common.loading")} />;
  const tz = catalog.settings.business.timezone;
  const now = Date.now();
  const upcoming = data.appointments.filter((a) => new Date(a.starts_at).getTime() >= now && ["HELD", "PENDING_REVIEW", "CONFIRMED", "CHECKED_IN"].includes(a.status)).reverse();
  const past = data.appointments.filter((a) => !upcoming.includes(a));
  const errText = (e: unknown) => (e instanceof ApiError ? (t(`errors.${e.code}`) !== `errors.${e.code}` ? t(`errors.${e.code}`) : e.message) : t("common.error"));

  async function cancel(id: string) {
    try {
      await api.post(`me/appointments/${id}/cancel`, { reason });
      setMsg({ tone: "success", text: t("account.status.CANCELLED_BY_CLIENT") });
      setCancelling(null);
      void reload();
    } catch (e) {
      setMsg({ tone: "error", text: errText(e) });
    }
  }
  async function reschedule(id: string) {
    if (!slot) return;
    try {
      await api.post(`me/appointments/${id}/reschedule`, { startsAt: slot.start, therapistId: null });
      setMsg({ tone: "success", text: t("account.status.RESCHEDULED") });
      setRescheduling(null);
      setSlot(null);
      void reload();
    } catch (e) {
      setMsg({ tone: "error", text: errText(e) });
    }
  }

  const card = (a: Appt, actions: boolean) => (
    <li key={a.id} className="card space-y-3 p-5" data-appointment={a.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold text-brand-deep">{locale === "es" ? a.service_name_es : a.service_name_en} · {t("common.minutes", { n: a.minutes })}</p>
          <p className="mt-1 flex items-center gap-1.5 text-ink"><CalendarClock className="h-4 w-4 text-brand-royal" aria-hidden />{dateTime(a.starts_at, locale, tz)}</p>
          <p className="mt-1 text-sm text-ink-muted">{a.therapist_name}{a.enhancements.length ? ` · ${a.enhancements.map((e) => (locale === "es" ? e.name_es : e.name_en)).join(", ")}` : ""} · {money(a.total_cents, locale)}</p>
        </div>
        <StatusBadge status={a.status} label={t(`account.status.${a.status}`)} />
      </div>
      {actions && ["PENDING_REVIEW", "CONFIRMED"].includes(a.status) && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => { setRescheduling(rescheduling === a.id ? null : a.id); setCancelling(null); setSlot(null); }}>{t("account.reschedule")}</button>
          <button type="button" className="btn-danger btn-sm" onClick={() => { setCancelling(cancelling === a.id ? null : a.id); setRescheduling(null); }}>{t("account.cancel")}</button>
        </div>
      )}
      {cancelling === a.id && (
        <div className="space-y-3 rounded-xl bg-stop-bg/60 p-4">
          <p className="font-medium">{t("account.cancelConfirm")}</p>
          <Field id={`reason-${a.id}`} label={t("account.cancelReason")}><input id={`reason-${a.id}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2">
            <button type="button" className="btn-danger btn-sm" onClick={() => void cancel(a.id)}>{t("account.cancel")}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setCancelling(null)}>{t("account.keep")}</button>
          </div>
        </div>
      )}
      {rescheduling === a.id && (
        <div className="space-y-4 rounded-xl bg-brand-lilac p-4">
          <p className="font-medium">{t("account.rescheduleTitle")}</p>
          <BookingCalendar serviceId={a.service_id} minutes={a.minutes} enhancementIds={a.enhancement_ids} therapistId={a.therapist_id} settings={catalog.settings} value={slot} onChange={setSlot} excludeAppointmentId={a.id} />
          <button type="button" className="btn-primary btn-sm" disabled={!slot} onClick={() => void reschedule(a.id)}>{t("account.rescheduleConfirm")}</button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-10">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-2xl">{t("account.upcoming")}</h2><Link to="/book" className="btn-primary btn-sm">{t("account.bookOne")}</Link></div>
        {upcoming.length ? <ul className="space-y-3">{upcoming.map((a) => card(a, true))}</ul> : <p className="text-ink-muted">{t("account.noUpcoming")}</p>}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl">{t("account.past")}</h2>
        {past.length ? <ul className="space-y-3">{past.map((a) => card(a, false))}</ul> : <p className="text-ink-muted">{t("account.noPast")}</p>}
      </section>
    </div>
  );
}

function ProfileTab() {
  const { t, locale } = useI18n();
  const { me, refresh } = useAuth();
  const c = me?.client;
  const [f, setF] = useState({ firstName: c?.first_name ?? "", lastName: c?.last_name ?? "", preferredName: c?.preferred_name ?? "", phone: c?.phone ?? "", dateOfBirth: c?.date_of_birth ?? "" });
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put("me/profile", { ...f, preferredName: f.preferredName || null, dateOfBirth: f.dateOfBirth || null, locale });
      setMsg({ tone: "success", text: t("common.saved") });
      await refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof ApiError ? t(`errors.${err.code}`) : t("common.error") });
    }
  }
  return (
    <form onSubmit={save} className="card max-w-2xl space-y-5 p-6">
      <p className="text-ink-muted">{t("account.profileLead")}</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pf-first" label={t("booking.firstName")}><input id="pf-first" className="input" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field id="pf-last" label={t("booking.lastName")}><input id="pf-last" className="input" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        <Field id="pf-pref" label={t("booking.preferredName")} optional={t("common.optional")}><input id="pf-pref" className="input" value={f.preferredName} onChange={(e) => setF({ ...f, preferredName: e.target.value })} /></Field>
        <Field id="pf-phone" label={t("booking.phone")}><input id="pf-phone" className="input" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field id="pf-dob" label={t("booking.dob")} optional={t("common.optional")}><input id="pf-dob" className="input" type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} /></Field>
        <Field id="pf-email" label={t("contact.email")}><input id="pf-email" className="input" value={me?.user.email ?? ""} disabled /></Field>
      </div>
      <button type="submit" className="btn-primary">{t("common.save")}</button>
    </form>
  );
}

function IntakeTab() {
  const { t } = useI18n();
  const { catalog } = useCatalog();
  const { me } = useAuth();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    api.get<{ intake: Intake | null }>("me/intake").then((r) => setIntake({ ...emptyIntake(), ...(r.intake ?? {}) })).catch(() => setIntake(emptyIntake()));
  }, []);
  if (!me?.client) return <Alert tone="info">{t("account.completeProfile")}</Alert>;
  if (!intake || !catalog) return <Spinner label={t("common.loading")} />;
  return (
    <form className="card space-y-6 p-6" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api.put("me/intake", intake);
        setMsg({ tone: "success", text: t("intake.saved") });
      } catch (err) {
        setMsg({ tone: "error", text: err instanceof ApiError ? (t(`errors.${err.code}`) !== `errors.${err.code}` ? t(`errors.${err.code}`) : err.message) : t("common.error") });
      }
    }}>
      <div><h2 className="text-2xl">{t("intake.title")}</h2><p className="mt-1 text-ink-muted">{t("intake.lead")}</p></div>
      <IntakeForm value={intake} onChange={setIntake} screeningItems={catalog.screeningItems} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button type="submit" className="btn-primary">{t("common.save")}</button>
    </form>
  );
}

function ConsentsTab() {
  const { t, locale, pick } = useI18n();
  const { data } = useLoad<{ signatures: (Record<string, unknown> & { id: string; signed_name: string; signed_at: string })[] }>("me/consents");
  if (!data) return <Spinner label={t("common.loading")} />;
  return (
    <div className="space-y-3">
      <p className="text-ink-muted">{t("account.consentsLead")}</p>
      {!data.signatures.length && <p>{t("account.noConsents")}</p>}
      {data.signatures.map((s) => (
        <details key={s.id} className="card p-5">
          <summary className="cursor-pointer font-medium text-brand-deep">{pick(s, "title")} · {s.signed_name} · {new Date(s.signed_at).toLocaleDateString(locale === "es" ? "es-US" : "en-US")}</summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{pick(s, "body")}</p>
        </details>
      ))}
    </div>
  );
}

function ReceiptsTab() {
  const { t, locale } = useI18n();
  const { data } = useLoad<{ payments: { id: string; kind: string; status: string; amount_cents: number; refunded_cents: number; receipt_url: string | null; created_at: string; name_en: string | null; name_es: string | null }[] }>("me/receipts");
  if (!data) return <Spinner label={t("common.loading")} />;
  return (
    <div className="space-y-3">
      <p className="text-ink-muted">{t("account.receiptsLead")}</p>
      {!data.payments.length && <p>{t("account.noReceipts")}</p>}
      {data.payments.map((p) => (
        <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium">{(locale === "es" ? p.name_es : p.name_en) ?? "RESTORA"} · {money(p.amount_cents, locale)}</p>
            <p className="text-sm text-ink-muted">{new Date(p.created_at).toLocaleDateString(locale === "es" ? "es-US" : "en-US")}{p.refunded_cents ? ` · ${t("account.refunded", { amount: money(p.refunded_cents, locale) })}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={p.status} label={p.status.replace(/_/g, " ").toLowerCase()} />
            {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">{t("account.viewReceipt")}<ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreferencesTab() {
  const { t, locale, setLocale } = useI18n();
  const { me, refresh } = useAuth();
  const c = me?.client;
  const [p, setP] = useState({ emailOptIn: c?.email_opt_in ?? true, smsOptIn: c?.sms_opt_in ?? false, marketingOptIn: c?.marketing_opt_in ?? false, locale: (me?.user.locale ?? locale) as Locale });
  const [msg, setMsg] = useState<string | null>(null);
  if (!c) return <Alert tone="info">{t("account.completeProfile")}</Alert>;
  return (
    <form className="card max-w-xl space-y-5 p-6" onSubmit={async (e) => {
      e.preventDefault();
      await api.put("me/preferences", p);
      setLocale(p.locale);
      setMsg(t("common.saved"));
      void refresh();
    }}>
      <p className="text-ink-muted">{t("account.prefsLead")}</p>
      {(["emailOptIn", "smsOptIn", "marketingOptIn"] as const).map((k) => (
        <label key={k} className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-brand-deep" checked={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />
          {t(`account.${k}`)}
        </label>
      ))}
      <Field id="pref-lang" label={t("account.language")}>
        <select id="pref-lang" className="input" value={p.locale} onChange={(e) => setP({ ...p, locale: e.target.value as Locale })}>
          <option value="en">English</option><option value="es">Español</option>
        </select>
      </Field>
      {msg && <Alert tone="success">{msg}</Alert>}
      <button type="submit" className="btn-primary">{t("common.save")}</button>
    </form>
  );
}

function RecordsTab() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const { data, reload } = useLoad<{ requests: { id: string; details: string; created_at: string; fulfilled_at: string | null }[] }>("me/records-requests");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!me?.client) return <Alert tone="info">{t("account.completeProfile")}</Alert>;
  return (
    <div className="max-w-2xl space-y-6">
      <form className="card space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        await api.post("me/records-requests", { details });
        setDetails("");
        setMsg(t("account.recordsSent"));
        void reload();
      }}>
        <p className="leading-relaxed text-ink-muted">{t("account.recordsLead")}</p>
        <Field id="rec-details" label={t("account.recordsDetails")}><textarea id="rec-details" className="textarea" value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        {msg && <Alert tone="success">{msg}</Alert>}
        <button type="submit" className="btn-primary" disabled={details.trim().length < 5}>{t("account.recordsSubmit")}</button>
      </form>
      {data && data.requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">{t("account.recordsHistory")}</h2>
          {data.requests.map((r) => (
            <div key={r.id} className="card flex justify-between gap-3 p-4 text-sm">
              <span>{new Date(r.created_at).toLocaleDateString(locale === "es" ? "es-US" : "en-US")} — {r.details}</span>
              <StatusBadge status={r.fulfilled_at ? "COMPLETED" : "PENDING_REVIEW"} label={r.fulfilled_at ? t("account.fulfilled") : t("account.pending")} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
