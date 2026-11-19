import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CircleAlert, Info, OctagonAlert, Stethoscope } from "lucide-react";
import { WellnessArt } from "@/components/brand/WellnessArt";
import { Spinner } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Category } from "@/types";
import { cn, money } from "@/utils/format";
import NotFound from "@/pages/NotFound";

const CAT: Record<Category, { icon: typeof Info; cls: string }> = {
  POSTPONE_OR_REFER: { icon: OctagonAlert, cls: "bg-stop-bg text-stop-ink" },
  CLEARANCE_REQUIRED: { icon: Stethoscope, cls: "bg-caution-bg text-caution-ink" },
  MODIFY_TREATMENT: { icon: CircleAlert, cls: "bg-brand-soft text-brand-deep" },
};
const ORDER: Category[] = ["POSTPONE_OR_REFER", "CLEARANCE_REQUIRED", "MODIFY_TREATMENT"];

export default function ServiceDetails() {
  const { slug } = useParams();
  const { t, pick, pickList, locale } = useI18n();
  const { catalog, loading } = useCatalog();
  const service = catalog?.services.find((s) => s.slug === slug);
  const durations = service?.durations.filter((d) => d.active) ?? [];
  const [minutes, setMinutes] = useState<number | null>(null);
  const selected = durations.find((d) => d.minutes === (minutes ?? 60)) ?? durations[0];

  const labels = useMemo(() => new Map(catalog?.screeningItems.map((s) => [s.code, s]) ?? []), [catalog]);
  if (loading) return <Spinner label={t("common.loading")} />;
  if (!catalog || !service) return <NotFound />;
  const row = service as unknown as Record<string, unknown>;
  const index = catalog.services.indexOf(service);
  const blocked = new Set(catalog.rules.filter((r) => r.kind === "SERVICE_BLOCKS_ENHANCEMENT" && r.service_id === service.id).map((r) => r.enhancement_a));
  const sections = ["overview", "expect", "benefits", "pressure", "candidates", "precautions", "enhancements"] as const;

  return (
    <article>
      <header className="bg-gradient-to-b from-brand-lilac to-brand-ivory">
        <div className="container-page grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Link to="/services" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-royal hover:text-brand-deep">
              <ArrowLeft className="h-4 w-4" aria-hidden />{t("detail.allServices")}
            </Link>
            <h1 className="text-4xl sm:text-5xl">{pick(row, "name")}</h1>
            <p className="max-w-xl text-lg leading-relaxed">{pick(row, "summary")}</p>
          </div>
          <WellnessArt variant={index} className="hidden aspect-[16/10] rounded-[1.75rem] shadow-soft lg:block" />
        </div>
      </header>

      <nav aria-label={t("detail.overview")} className="sticky top-[4.5rem] z-30 border-y border-line bg-brand-ivory/95 backdrop-blur">
        <ul className="container-page flex gap-1.5 overflow-x-auto py-2.5">
          {sections.map((id) => (
            <li key={id} className="shrink-0">
              <a href={`#${id}`} className="inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-muted hover:bg-brand-soft hover:text-brand-deep">{t(`detail.${id}`)}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <aside className="order-first lg:order-none lg:sticky lg:top-36 lg:self-start" aria-labelledby="pricing-title">
          <div className="card space-y-4 p-6">
            <h2 id="pricing-title" className="text-2xl">{t("detail.pricing")}</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("booking.chooseLength")}>
              {durations.map((d) => {
                const active = d.minutes === selected?.minutes;
                return (
                  <button key={d.minutes} type="button" role="radio" aria-checked={active} onClick={() => setMinutes(d.minutes)}
                    className={cn("flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2", active ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-white hover:bg-brand-lilac")}>
                    <span className="text-sm font-semibold">{t("common.minutes", { n: d.minutes })}</span>
                    <span className={cn("font-display text-xl font-semibold tabular-nums", !active && "text-brand-deep")}>{d.price_cents !== null ? money(d.price_cents, locale) : "—"}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-brand-lilac px-5 py-4" aria-live="polite">
              <span className="text-sm text-ink-muted">{selected ? t("common.minutes", { n: selected.minutes }) : ""}</span>
              <span className="font-display text-2xl font-semibold tabular-nums text-brand-deep">{selected?.price_cents != null ? money(selected.price_cents, locale) : t("common.pricingSoon")}</span>
            </div>
            <Link to={`/book?service=${service.slug}${selected ? `&minutes=${selected.minutes}` : ""}`} className="btn-primary btn-lg w-full">{t("detail.bookThis")}</Link>
          </div>
        </aside>

        <div className="min-w-0 space-y-14">
          <section id="overview" className="scroll-mt-36 space-y-3">
            <h2 className="text-3xl">{t("detail.overview")}</h2>
            <p className="text-lg leading-relaxed">{pick(row, "description")}</p>
          </section>
          <section id="expect" className="scroll-mt-36 space-y-4">
            <h2 className="text-3xl">{t("detail.expect")}</h2>
            <ol className="space-y-3">
              {pickList(row, "expect").map((x, i) => (
                <li key={x} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand-deep">{i + 1}</span>
                  <p className="pt-1 leading-relaxed">{x}</p>
                </li>
              ))}
            </ol>
          </section>
          <section id="benefits" className="scroll-mt-36 space-y-4">
            <h2 className="text-3xl">{t("detail.benefits")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {pickList(row, "benefits").map((b) => (
                <li key={b} className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-royal" aria-hidden />{b}</li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">{t("detail.disclaimer")}</p>
          </section>
          <section id="pressure" className="scroll-mt-36 space-y-4">
            <h2 className="text-3xl">{t("detail.pressure")}</h2>
            <div className="flex flex-wrap gap-2">
              {(["LIGHT", "MEDIUM", "FIRM"] as const).map((p) => {
                const ok = service.pressure_options.includes(p);
                return (
                  <span key={p} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium", ok ? "border-brand-deep/30 bg-white text-brand-deep" : "border-line text-ink-muted line-through")}>
                    {ok && <Check className="h-4 w-4" aria-hidden />}{t(`pressure.${p}`)}
                  </span>
                );
              })}
            </div>
            <p className="leading-relaxed text-ink-muted">{t("detail.pressureNote")}</p>
          </section>
          <section id="candidates" className="scroll-mt-36 space-y-4">
            <h2 className="text-3xl">{t("detail.candidates")}</h2>
            <ul className="space-y-2">
              {pickList(row, "candidates").map((c) => <li key={c} className="flex gap-3"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-royal" />{c}</li>)}
            </ul>
          </section>
          <section id="precautions" className="scroll-mt-36 space-y-5">
            <h2 className="text-3xl">{t("detail.precautions")}</h2>
            <p className="leading-relaxed">{t("detail.precautionsLead")}</p>
            {ORDER.map((cat) => {
              const items = service.screening.filter((s) => s.category === cat);
              if (!items.length) return null;
              const { icon: Icon, cls } = CAT[cat];
              return (
                <div key={cat} className="card overflow-hidden shadow-none">
                  <h3 className={cn("flex items-center gap-2.5 px-5 py-3 font-sans text-[0.95rem] font-semibold", cls)}><Icon className="h-5 w-5 shrink-0" aria-hidden />{t(`detail.category.${cat}`)}</h3>
                  <ul className="divide-y divide-line">
                    {items.map((s) => <li key={s.code} className="px-5 py-3">{pick(labels.get(s.code) as unknown as Record<string, unknown>, "label")}</li>)}
                  </ul>
                </div>
              );
            })}
            {[...pickList(row, "notes"), pick(catalog.settings.content as unknown as Record<string, unknown>, "lotion")].map((n) => (
              <p key={n} className="flex gap-3 rounded-2xl bg-brand-soft/70 px-5 py-4 leading-relaxed text-brand-deep"><Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{n}</p>
            ))}
          </section>
          <section id="enhancements" className="scroll-mt-36 space-y-4">
            <h2 className="text-3xl">{t("detail.enhancements")}</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {catalog.enhancements.map((e) => (
                <li key={e.id}>
                  <Link to={`/enhancements#${e.slug}`} className={cn("flex h-full flex-col gap-2 rounded-2xl border border-line bg-white p-4 hover:border-brand-lavender", blocked.has(e.id) && "opacity-60")}>
                    <span className="font-display text-xl font-semibold text-brand-deep">{pick(e as unknown as Record<string, unknown>, "name")}</span>
                    <span className="text-sm text-ink-muted">
                      {blocked.has(e.id) ? t("detail.notWith") : e.price_cents !== null ? `+${money(e.price_cents, locale)}` : t("common.pricingSoon")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
