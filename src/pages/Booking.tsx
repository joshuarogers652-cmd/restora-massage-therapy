import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck2, Check, ChevronLeft, CircleAlert, Clock, LogIn, Sparkles } from "lucide-react";
import { BookingCalendar } from "@/components/BookingCalendar";
import { ConcernsForm, IntakeForm } from "@/components/IntakeForm";
import { Alert, Field, Spinner } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import { api, ApiError } from "@/services/api";
import { loginUrl } from "@/services/auth";
import { checkPromotion, createBooking, type BookingResult, type Slot } from "@/services/booking";
import { emptyIntake, type Category, type Concerns, type Intake, type Pressure, type Profile } from "@/types";
import { cn, dateTime, money } from "@/utils/format";

const PaymentStep = lazy(() => import("@/components/booking/PaymentStep"));

// Only the non-sensitive selection is remembered across the sign-in redirect.
const DRAFT_KEY = "restora.bookingDraft";
type Draft = { serviceId: string | null; minutes: number | null; enhancementIds: string[]; therapistId: string | null; slot: Slot | null; step: number };

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export default function Booking() {
  const { t, tl, pick, locale } = useI18n();
  const { catalog, loading } = useCatalog();
  const { principal, me, refresh } = useAuth();
  const [params] = useSearchParams();

  const resumed = params.get("resume") ? loadDraft() : null;
  const [step, setStep] = useState(resumed?.step ?? 0);
  const [serviceId, setServiceId] = useState<string | null>(resumed?.serviceId ?? null);
  const [minutes, setMinutes] = useState<number | null>(resumed?.minutes ?? null);
  const [enhancementIds, setEnhancementIds] = useState<string[]>(resumed?.enhancementIds ?? []);
  const [therapistId, setTherapistId] = useState<string | null>(resumed?.therapistId ?? null);
  const [slot, setSlot] = useState<Slot | null>(resumed?.slot ?? null);
  const [profile, setProfile] = useState<Profile>({ firstName: "", lastName: "", preferredName: "", phone: "", dateOfBirth: "" });
  const [intake, setIntake] = useState<Intake>(emptyIntake());
  const [concerns, setConcerns] = useState<Concerns>({ areas: [], bothering: "", howLong: "", focus: "", pressure: "MEDIUM" });
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [promo, setPromo] = useState("");
  const [promoResult, setPromoResult] = useState<{ title: string; discount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Pick up ?service=slug&minutes=60 from service pages.
  useEffect(() => {
    if (!catalog || resumed || serviceId) return;
    const s = catalog.services.find((x) => x.slug === params.get("service"));
    if (s) {
      setServiceId(s.id);
      const m = Number(params.get("minutes"));
      if (s.durations.some((d) => d.minutes === m && d.price_cents !== null)) {
        setMinutes(m);
        setStep(2);
      } else setStep(1);
    }
  }, [catalog]);

  // Prefill the profile and intake for signed-in clients.
  useEffect(() => {
    if (!me || prefilled) return;
    setPrefilled(true);
    if (me.client) {
      setProfile({
        firstName: me.client.first_name, lastName: me.client.last_name, preferredName: me.client.preferred_name ?? "",
        phone: me.client.phone ?? "", dateOfBirth: me.client.date_of_birth ?? "",
      });
    }
    api.get<{ intake: Intake | null }>("me/intake").then((r) => r.intake && setIntake({ ...emptyIntake(), ...r.intake })).catch(() => undefined);
  }, [me, prefilled]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ serviceId, minutes, enhancementIds, therapistId, slot, step } satisfies Draft));
    } catch {
      /* ignore */
    }
  }, [serviceId, minutes, enhancementIds, therapistId, slot, step]);

  const service = catalog?.services.find((s) => s.id === serviceId) ?? null;
  const duration = service?.durations.find((d) => d.minutes === minutes) ?? null;
  const chosenEnh = catalog?.enhancements.filter((e) => enhancementIds.includes(e.id)) ?? [];
  const blockedIds = useMemo(
    () => new Set(catalog?.rules.filter((r) => r.kind === "SERVICE_BLOCKS_ENHANCEMENT" && r.service_id === serviceId).map((r) => r.enhancement_a) ?? []),
    [catalog, serviceId],
  );
  const incompatible = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of catalog?.rules ?? []) {
      if (r.kind !== "ENHANCEMENTS_INCOMPATIBLE" || !r.enhancement_b) continue;
      if (enhancementIds.includes(r.enhancement_a)) out.set(r.enhancement_b, pick(r as unknown as Record<string, unknown>, "reason"));
      if (enhancementIds.includes(r.enhancement_b)) out.set(r.enhancement_a, pick(r as unknown as Record<string, unknown>, "reason"));
    }
    return out;
  }, [catalog, enhancementIds, pick]);
  const qualifiedTherapists = catalog?.therapists.filter(
    (th) => service && th.service_ids.includes(service.id) && chosenEnh.filter((e) => e.requires_qualification).every((e) => th.enhancement_ids.includes(e.id)),
  ) ?? [];
  const totalMinutes = (duration?.minutes ?? 0) + chosenEnh.reduce((s, e) => s + (e.added_minutes ?? 0), 0);
  const subtotal = (duration?.price_cents ?? 0) + chosenEnh.reduce((s, e) => s + (e.price_cents ?? 0), 0);
  const discount = promoResult?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const pay = catalog?.settings.payments;
  const dueNow = pay?.mode === "full" ? total : pay?.mode === "deposit" ? Math.round((total * pay.depositPercent) / 100) : 0;

  const requiredConsents = useMemo(() => {
    if (!service) return [];
    return Array.from(new Set(["CANCELLATION_POLICY", ...service.requires_consents, ...chosenEnh.flatMap((e) => e.requires_consents)]));
  }, [service, chosenEnh]);

  const flags = useMemo(() => {
    if (!service) return [] as { code: string; category: Category }[];
    const reported = new Set(intake.conditions);
    if (intake.pregnant) reported.add("pregnancy");
    if (intake.allergies.trim() || intake.skinSensitivities.trim()) reported.add("allergies");
    const list = [...service.screening, ...chosenEnh.flatMap((e) => e.screening)].filter((s) => reported.has(s.code));
    return list.filter((s, i) => list.findIndex((x) => x.code === s.code) === i);
  }, [service, chosenEnh, intake]);

  if (loading || !catalog) return <Spinner label={t("common.loading")} />;
  if (!catalog.settings.booking.onlineBookingEnabled) {
    return <div className="container-page py-20"><Alert tone="info">{t("booking.disabled")} <Link to="/contact" className="font-semibold underline">{t("nav.contact")}</Link></Alert></div>;
  }
  const tz = catalog.settings.business.timezone;
  const steps = tl<string[]>("booking.steps");
  const labels = new Map(catalog.screeningItems.map((s) => [s.code, s]));
  const errText = (e: unknown) => {
    if (e instanceof ApiError) {
      const k = `errors.${e.code}`;
      const tr = t(k);
      const fields = e.code === "VALIDATION" && Array.isArray(e.details) ? ` (${(e.details as { path: string }[]).map((d) => d.path).join(", ")})` : "";
      return (tr !== k ? tr : e.message) + fields;
    }
    return t("common.error");
  };

  const canNext = [
    !!service,
    !!duration && duration.price_cents !== null,
    true,
    true,
    !!slot,
    !!profile.firstName.trim() && !!profile.lastName.trim() && profile.phone.trim().length >= 7,
    requiredConsents.every((k) => (signatures[k] ?? "").trim().length >= 2),
    true,
  ][step];

  async function submit() {
    if (!service || !duration || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await createBooking({
        serviceId: service.id,
        minutes: duration.minutes,
        enhancementIds,
        therapistId,
        startsAt: slot.start,
        profile: { ...profile, preferredName: profile.preferredName || null, dateOfBirth: profile.dateOfBirth || null },
        intake,
        concerns,
        consents: requiredConsents.map((kind) => ({ kind, signedName: signatures[kind]!.trim() })),
        promotionCode: promoResult ? promo : null,
        locale,
      });
      setResult(r);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      void refresh();
    } catch (e) {
      setError(errText(e));
      if (e instanceof ApiError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_UNAVAILABLE")) {
        setSlot(null);
        setStep(4);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Finished ──
  if (result && !(result.status === "HELD" && result.payment)) {
    const pending = result.status === "PENDING_REVIEW";
    return (
      <div className="container-page flex justify-center py-16 sm:py-24">
        <div className="card w-full max-w-xl space-y-5 p-8 text-center">
          <CalendarCheck2 className="mx-auto h-12 w-12 text-brand-royal" aria-hidden />
          <h1 className="text-3xl sm:text-4xl">{pending ? t("booking.donePendingTitle") : t("booking.doneTitle")}</h1>
          <p className="text-lg">{service && pick(service as unknown as Record<string, unknown>, "name")} · {dateTime(result.startsAt, locale, tz)}</p>
          <p className="leading-relaxed text-ink-muted">{pending ? t("booking.donePendingBody") : t("booking.doneBody")}</p>
          <Link to="/account" className="btn-primary btn-lg">{t("booking.viewAppointments")}</Link>
        </div>
      </div>
    );
  }
  if (result?.payment) {
    return (
      <div className="container-page flex justify-center py-16">
        <div className="card w-full max-w-xl space-y-5 p-8">
          <h1 className="text-3xl">{t("booking.paymentTitle")}</h1>
          <p className="text-ink-muted">{t("booking.holdNotice", { n: 15 })}</p>
          <Suspense fallback={<Spinner label={t("common.loading")} />}>
            <PaymentStep clientSecret={result.payment.clientSecret} publishableKey={result.payment.publishableKey} amountLabel={money(result.amountDueNowCents, locale)} />
          </Suspense>
        </div>
      </div>
    );
  }

  const needsSignIn = step >= 5 && !principal;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mb-8 space-y-2">
        <p className="eyebrow">{t("booking.stepOf", { n: step + 1, total: steps.length })}</p>
        <h1 className="text-4xl">{t("booking.title")}</h1>
        <ol className="mt-4 flex gap-1.5 overflow-x-auto pb-1" aria-label={t("booking.title")}>
          {steps.map((s, i) => (
            <li key={s} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium", i === step ? "bg-brand-deep text-white" : i < step ? "bg-brand-soft text-brand-deep" : "bg-white text-ink-muted ring-1 ring-line")} aria-current={i === step ? "step" : undefined}>
              {i < step && <Check className="-ml-0.5 mr-1 inline h-3.5 w-3.5" aria-hidden />}{s}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {error && <Alert tone="error">{error}</Alert>}

          {step === 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl">{t("booking.chooseService")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.services.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setServiceId(s.id); setMinutes(null); setEnhancementIds([]); setSlot(null); setStep(1); }}
                    className={cn("card flex flex-col items-start gap-2 p-5 text-left transition-shadow hover:shadow-lift", serviceId === s.id && "ring-2 ring-brand-royal")} data-service={s.slug}>
                    <span className="font-display text-2xl font-semibold text-brand-deep">{pick(s as unknown as Record<string, unknown>, "name")}</span>
                    <span className="text-sm leading-relaxed text-ink-muted">{pick(s as unknown as Record<string, unknown>, "summary")}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 1 && service && (
            <section className="space-y-4">
              <h2 className="text-2xl">{t("booking.chooseLength")}</h2>
              <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={t("booking.chooseLength")}>
                {service.durations.filter((d) => d.active).map((d) => (
                  <button key={d.minutes} type="button" role="radio" aria-checked={minutes === d.minutes} disabled={d.price_cents === null}
                    onClick={() => { setMinutes(d.minutes); setSlot(null); }}
                    className={cn("flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border px-2", minutes === d.minutes ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-white hover:bg-brand-lilac", d.price_cents === null && "opacity-50")}>
                    <span className="text-sm font-semibold">{t("common.minutes", { n: d.minutes })}</span>
                    <span className="font-display text-2xl font-semibold">{d.price_cents !== null ? money(d.price_cents, locale) : "—"}</span>
                    {d.price_cents === null && <span className="text-xs">{t("booking.unpricedLength")}</span>}
                  </button>
                ))}
              </div>
              <div className="card space-y-2 p-5">
                <h3 className="font-sans text-base font-semibold text-ink">{t("booking.readDetails")}</h3>
                <p className="leading-relaxed text-ink-muted">{pick(service as unknown as Record<string, unknown>, "description")}</p>
                <Link to={`/services/${service.slug}`} target="_blank" className="text-sm font-medium text-brand-royal underline-offset-2 hover:underline">{t("services.learnMore")} ↗</Link>
              </div>
            </section>
          )}

          {step === 2 && service && (
            <section className="space-y-4">
              <h2 className="text-2xl">{t("booking.chooseEnhancements")}</h2>
              {catalog.enhancements.filter((e) => e.bookable).length === 0 && <p className="text-ink-muted">{t("booking.enhancementsNone")}</p>}
              <div className="grid gap-3">
                {catalog.enhancements.filter((e) => e.bookable).map((e) => {
                  const blocked = blockedIds.has(e.id);
                  const conflict = incompatible.get(e.id);
                  const checked = enhancementIds.includes(e.id);
                  const disabled = blocked || (!!conflict && !checked);
                  return (
                    <label key={e.id} className={cn("card flex cursor-pointer gap-4 p-5", checked && "ring-2 ring-brand-royal", disabled && "cursor-not-allowed opacity-60")}>
                      <input type="checkbox" className="mt-1.5 h-5 w-5 accent-brand-deep" checked={checked} disabled={disabled} data-enhancement={e.slug}
                        onChange={() => { setEnhancementIds((ids) => (ids.includes(e.id) ? ids.filter((x) => x !== e.id) : [...ids, e.id])); setSlot(null); }} />
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-display text-xl font-semibold text-brand-deep">{pick(e as unknown as Record<string, unknown>, "name")}</span>
                          <span className="text-sm font-medium">+{e.added_minutes} min · +{money(e.price_cents!, locale)}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-ink-muted">{pick(e as unknown as Record<string, unknown>, "description")}</p>
                        {e.screening.length > 0 && (
                          <p className="text-xs text-ink-muted"><span className="font-semibold">{t("enhancements.screening")}:</span> {e.screening.map((s) => pick(labels.get(s.code) as unknown as Record<string, unknown>, "label")).join(" · ")}</p>
                        )}
                        {blocked && <p className="text-sm font-medium text-caution-ink">{t("booking.blocked")}</p>}
                        {conflict && !checked && <p className="text-sm font-medium text-caution-ink">{conflict}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {step === 3 && service && (
            <section className="space-y-4">
              <h2 className="text-2xl">{t("booking.chooseTherapist")}</h2>
              {qualifiedTherapists.length === 0 ? (
                <Alert tone="info">{t("booking.noTherapists")}</Alert>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("booking.chooseTherapist")}>
                  {[{ id: null as string | null, name: t("booking.anyTherapist"), bio: "" }, ...qualifiedTherapists.map((th) => ({ id: th.id as string | null, name: th.display_name, bio: pick(th as unknown as Record<string, unknown>, "bio") }))].map((o) => (
                    <button key={o.id ?? "any"} type="button" role="radio" aria-checked={therapistId === o.id} onClick={() => { setTherapistId(o.id); setSlot(null); }}
                      className={cn("card flex flex-col items-start gap-1 p-5 text-left", therapistId === o.id && "ring-2 ring-brand-royal")}>
                      <span className="font-display text-xl font-semibold text-brand-deep">{o.name}</span>
                      {o.bio && <span className="text-sm text-ink-muted">{o.bio}</span>}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 4 && service && duration && (
            <section className="space-y-4">
              <h2 className="text-2xl">{steps[4]}</h2>
              <BookingCalendar serviceId={service.id} minutes={duration.minutes} enhancementIds={enhancementIds} therapistId={therapistId} settings={catalog.settings} value={slot} onChange={setSlot} />
            </section>
          )}

          {needsSignIn && (
            <section className="card space-y-4 p-6 text-center">
              <LogIn className="mx-auto h-9 w-9 text-brand-royal" aria-hidden />
              <h2 className="text-2xl">{t("booking.signInToContinue")}</h2>
              <p className="text-ink-muted">{t("booking.signInLead")}</p>
              <a href={loginUrl("/book?resume=1")} className="btn-primary btn-lg">{t("nav.signIn")}</a>
            </section>
          )}

          {step === 5 && !needsSignIn && service && (
            <section className="space-y-8">
              <div className="card space-y-5 p-6">
                <h2 className="text-2xl">{t("booking.profileTitle")}</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="p-first" label={t("booking.firstName")}><input id="p-first" className="input" autoComplete="given-name" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></Field>
                  <Field id="p-last" label={t("booking.lastName")}><input id="p-last" className="input" autoComplete="family-name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} /></Field>
                  <Field id="p-pref" label={t("booking.preferredName")} optional={t("common.optional")}><input id="p-pref" className="input" value={profile.preferredName} onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })} /></Field>
                  <Field id="p-phone" label={t("booking.phone")}><input id="p-phone" className="input" type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
                  <Field id="p-dob" label={t("booking.dob")} optional={t("common.optional")}><input id="p-dob" className="input" type="date" autoComplete="bday" value={profile.dateOfBirth} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} /></Field>
                </div>
              </div>
              <div className="card space-y-6 p-6">
                <div><h2 className="text-2xl">{t("intake.title")}</h2><p className="mt-1 text-ink-muted">{t("intake.lead")}</p></div>
                <IntakeForm value={intake} onChange={setIntake} screeningItems={catalog.screeningItems} />
              </div>
              <div className="card space-y-6 p-6">
                <h2 className="text-2xl">{t("intake.visitTitle")}</h2>
                <ConcernsForm value={concerns} onChange={setConcerns} pressureOptions={service.pressure_options as Pressure[]} />
              </div>
            </section>
          )}

          {step === 6 && !needsSignIn && service && (
            <section className="space-y-6">
              <h2 className="text-2xl">{t("booking.safetyTitle")}</h2>
              {flags.length > 0 ? (
                <div className="card space-y-3 p-5">
                  <Alert tone="warning">{t("booking.reviewNotice")}</Alert>
                  <ul className="space-y-2">
                    {flags.map((f) => (
                      <li key={f.code} className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-caution-ink" aria-hidden />
                        <span><span className="font-medium">{pick(labels.get(f.code) as unknown as Record<string, unknown>, "label")}</span><br /><span className="text-sm text-ink-muted">{t(`detail.category.${f.category}`)}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Alert tone="info">{t("intake.noDiagnosis")}</Alert>
              )}
              <p className="rounded-2xl bg-brand-soft/70 px-5 py-4 text-brand-deep">{pick(catalog.settings.content as unknown as Record<string, unknown>, "lotion")}</p>
              <h3 className="text-xl">{t("booking.consentsTitle")}</h3>
              {requiredConsents.map((kind) => {
                const form = catalog.consentForms.find((f) => f.kind === kind);
                if (!form) return null;
                const signed = (signatures[kind] ?? "").trim().length >= 2;
                return (
                  <div key={kind} className="card space-y-3 p-5" data-consent={kind}>
                    <h4 className="font-display text-xl font-semibold text-brand-deep">{pick(form as unknown as Record<string, unknown>, "title")}</h4>
                    <p className="max-h-48 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink">{pick(form as unknown as Record<string, unknown>, "body")}</p>
                    <Field id={`sig-${kind}`} label={t("booking.consentSign")}>
                      <input id={`sig-${kind}`} className="input" value={signatures[kind] ?? ""} onChange={(e) => setSignatures({ ...signatures, [kind]: e.target.value })} />
                    </Field>
                    {signed && <p className="flex items-center gap-1.5 text-sm font-medium text-go-ink"><Check className="h-4 w-4" />{t("booking.consentSigned")}</p>}
                  </div>
                );
              })}
            </section>
          )}

          {step === 7 && !needsSignIn && service && duration && slot && (
            <section className="space-y-5">
              <h2 className="text-2xl">{t("booking.reviewTitle")}</h2>
              {flags.length > 0 && <Alert tone="warning">{t("booking.reviewNotice")}</Alert>}
              <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
                <div className="flex-1"><Field id="promo" label={t("booking.promo")} optional={t("common.optional")}><input id="promo" className="input uppercase" value={promo} onChange={(e) => { setPromo(e.target.value); setPromoResult(null); }} /></Field></div>
                <button type="button" className="btn-secondary" disabled={!promo.trim()} onClick={async () => {
                  setError(null);
                  try {
                    const r = await checkPromotion(promo.trim(), subtotal);
                    setPromoResult({ title: locale === "es" ? r.title_es : r.title_en, discount: r.discountCents });
                  } catch (e) { setError(errText(e)); }
                }}>{t("booking.apply")}</button>
              </div>
              {promoResult && <Alert tone="success">{t("booking.promoApplied", { title: promoResult.title })}</Alert>}
              <p className="text-ink-muted">{dueNow > 0 ? `${t("booking.dueNow")}: ${money(dueNow, locale)}` : t("booking.dueAtVisit")}</p>
              <button type="button" className="btn-primary btn-lg w-full sm:w-auto" disabled={submitting} onClick={() => void submit()}>
                {submitting ? t("booking.confirming") : dueNow > 0 ? t("booking.payAndConfirm") : t("booking.confirm")}
              </button>
            </section>
          )}

          <div className="flex justify-between gap-3 border-t border-line pt-6">
            <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => { setError(null); setStep((s) => s - 1); }}>
              <ChevronLeft className="h-4 w-4" />{t("common.back")}
            </button>
            {step < 7 && !needsSignIn && (
              <button type="button" className="btn-primary" disabled={!canNext} onClick={() => { setError(null); setStep((s) => s + 1); window.scrollTo({ top: 0 }); }}>
                {t("common.continue")}
              </button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label={t("booking.reviewTitle")}>
          <div className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-brand-royal" aria-hidden />{t("booking.reviewTitle")}</h2>
            <dl className="space-y-3 text-sm">
              <Row label={t("booking.service")} value={service ? pick(service as unknown as Record<string, unknown>, "name") : "—"} />
              <Row label={t("booking.length")} value={duration ? `${t("common.minutes", { n: duration.minutes })} · ${duration.price_cents !== null ? money(duration.price_cents, locale) : "—"}` : "—"} />
              <Row label={t("booking.enhancements")} value={chosenEnh.length ? chosenEnh.map((e) => `${pick(e as unknown as Record<string, unknown>, "name")} (+${money(e.price_cents ?? 0, locale)})`).join(", ") : t("common.none")} />
              <Row label={t("booking.therapist")} value={therapistId ? catalog.therapists.find((x) => x.id === therapistId)?.display_name ?? "—" : t("booking.anyTherapist")} />
              <Row label={t("booking.when")} value={slot ? dateTime(slot.start, locale, tz) : "—"} />
              <Row label={t("booking.totalTime")} value={duration ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("common.minutes", { n: totalMinutes })}</span> : "—"} />
            </dl>
            <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt>{t("booking.subtotal")}</dt><dd className="tabular-nums">{money(subtotal, locale)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-go-ink"><dt>{t("booking.discount")}</dt><dd className="tabular-nums">−{money(discount, locale)}</dd></div>}
              <div className="flex justify-between text-base font-semibold text-brand-deep"><dt>{t("booking.total")}</dt><dd className="tabular-nums" data-testid="booking-total">{money(total, locale)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
