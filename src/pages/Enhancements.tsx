import { ClipboardCheck, ShieldAlert, Sparkles, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionHeading, Spinner } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import { money } from "@/utils/format";

export default function Enhancements() {
  const { t, pick, pickList, locale } = useI18n();
  const { catalog, loading } = useCatalog();
  if (loading || !catalog) return <Spinner label={t("common.loading")} />;
  const labels = new Map(catalog.screeningItems.map((s) => [s.code, s]));
  return (
    <div className="container-page space-y-12 py-14 sm:py-20">
      <SectionHeading as="h1" eyebrow={t("enhancements.eyebrow")} title={t("enhancements.title")} lead={t("enhancements.lead")} />
      <div className="grid gap-6 lg:grid-cols-3">
        {catalog.enhancements.map((e) => {
          const row = e as unknown as Record<string, unknown>;
          const notWith = catalog.rules
            .filter((r) => r.kind === "SERVICE_BLOCKS_ENHANCEMENT" && r.enhancement_a === e.id)
            .map((r) => pick(catalog.services.find((s) => s.id === r.service_id) as unknown as Record<string, unknown>, "name"));
          return (
            <article key={e.id} id={e.slug} className="card flex scroll-mt-28 flex-col gap-5 p-6">
              <div className="space-y-2">
                <Sparkles className="h-6 w-6 text-brand-royal" aria-hidden />
                <h2 className="text-2xl">{pick(row, "name")}</h2>
                <p className="leading-relaxed text-ink-muted">{pick(row, "description")}</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-lilac px-4 py-3 text-sm">
                <span className="text-ink-muted">{t("enhancements.added")}</span>
                <span className="font-medium text-brand-deep">
                  {e.price_cents !== null && e.added_minutes !== null ? `+${e.added_minutes} min · +${money(e.price_cents, locale)}` : t("common.pricingSoon")}
                </span>
              </div>
              <div>
                <h3 className="mb-2 font-sans text-sm font-semibold text-ink">{t("enhancements.benefits")}</h3>
                <ul className="space-y-1.5 text-[0.95rem] text-ink-muted">
                  {pickList(row, "benefits").map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-royal" aria-hidden />{b}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink"><ShieldAlert className="h-4 w-4 text-brand-royal" aria-hidden />{t("enhancements.screening")}</h3>
                <ul className="space-y-1.5 text-[0.95rem] text-ink-muted">
                  {e.screening.map((s) => <li key={s.code} className="flex gap-2.5"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-lavender" />{pick(labels.get(s.code) as unknown as Record<string, unknown>, "label")}</li>)}
                </ul>
              </div>
              {pickList(row, "requirements").length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink"><ClipboardCheck className="h-4 w-4 text-brand-royal" aria-hidden />{t("enhancements.requirements")}</h3>
                  <ul className="space-y-1.5 text-[0.95rem] text-ink-muted">
                    {pickList(row, "requirements").map((r) => <li key={r} className="flex gap-2.5"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-lavender" />{r}</li>)}
                  </ul>
                </div>
              )}
              {notWith.length > 0 && <p className="rounded-xl bg-caution-bg px-4 py-3 text-sm text-caution-ink">{t("detail.notWith")}: {notWith.join(", ")}</p>}
              {!e.bookable && <p className="text-sm text-ink-muted">{t("enhancements.unavailable")}</p>}
            </article>
          );
        })}
      </div>
      <div className="flex justify-center"><Link to="/book" className="btn-primary btn-lg">{t("nav.book")}</Link></div>
    </div>
  );
}
