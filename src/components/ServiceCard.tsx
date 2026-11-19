import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { WellnessArt } from "@/components/brand/WellnessArt";
import { useI18n } from "@/contexts/I18nContext";
import type { Service } from "@/types";
import { money } from "@/utils/format";

export function startingPrice(s: Service) {
  const prices = s.durations.filter((d) => d.active && d.price_cents !== null).map((d) => d.price_cents!);
  return prices.length ? Math.min(...prices) : null;
}

export function ServiceCard({ service, index }: { service: Service; index: number }) {
  const { t, pick, pickList, locale } = useI18n();
  const from = startingPrice(service);
  const row = service as unknown as Record<string, unknown>;
  return (
    <article className="card group relative flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lift">
      <WellnessArt variant={index} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <h3 className="text-2xl">
            <Link to={`/services/${service.slug}`} className="after:absolute after:inset-0 focus:outline-none">
              {pick(row, "name")}
            </Link>
          </h3>
          <p className="leading-relaxed text-ink-muted">{pick(row, "summary")}</p>
        </div>
        <ul className="space-y-1 text-sm text-ink" aria-label={t("services.benefits")}>
          {pickList(row, "benefits").slice(0, 2).map((b) => (
            <li key={b} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-lavender" />{b}</li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4 text-sm">
          <div className="flex flex-wrap gap-1.5" aria-label={t("services.durations")}>
            {service.durations.filter((d) => d.active).map((d) => (
              <span key={d.minutes} className="rounded-full bg-brand-lilac px-2.5 py-1 font-medium tabular-nums text-brand-deep">
                {t("common.minutes", { n: d.minutes })}
              </span>
            ))}
          </div>
          <div className="text-right">
            {from !== null ? (
              <><span className="text-ink-muted">{t("common.from")} </span><span className="font-display text-2xl font-semibold tabular-nums text-brand-deep">{money(from, locale)}</span></>
            ) : (
              <span className="text-ink-muted">{t("common.pricingSoon")}</span>
            )}
          </div>
        </div>
        <div className="relative z-10 flex gap-2">
          <Link to={`/services/${service.slug}`} className="btn-secondary btn-sm flex-1">{t("services.learnMore")}</Link>
          <Link to={`/book?service=${service.slug}`} className="btn-primary btn-sm flex-1">
            {t("services.bookNow")} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
