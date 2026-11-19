import { Link } from "react-router-dom";
import { BadgeCheck, CalendarClock, Droplet, HeartHandshake, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { LotusMark } from "@/components/brand/Logo";
import { WellnessArt } from "@/components/brand/WellnessArt";
import { ServiceCard } from "@/components/ServiceCard";
import { ContactDetails } from "@/pages/Contact";
import { SectionHeading, Spinner } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";
import { money } from "@/utils/format";

export default function Home() {
  const { t, tl, pick, locale } = useI18n();
  const { catalog, loading } = useCatalog();
  const why = [
    [HeartHandshake, "personal"], [BadgeCheck, "licensed"], [Leaf, "comfort"], [ShieldCheck, "safety"], [Droplet, "products"], [CalendarClock, "booking"],
  ] as const;

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-lilac via-brand-soft/60 to-brand-ivory">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-24">
          <div className="space-y-7">
            <div className="space-y-4">
              <LotusMark className="h-12 w-auto" />
              <h1 className="text-[2.7rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem]">
                <span className="block tracking-[0.06em]">RESTORA</span>
                <span className="mt-1 block font-sans text-sm font-medium uppercase tracking-[0.4em] text-brand-royal sm:text-base">{t("brand.descriptor")}</span>
              </h1>
              <p className="font-display text-2xl italic text-brand-royal sm:text-3xl">{t("brand.tagline")}</p>
            </div>
            <p className="max-w-xl text-lg leading-relaxed">{t("home.lead")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/book" className="btn-primary btn-lg tracking-wide">{t("home.primary")}</Link>
              <Link to="/services" className="btn-secondary btn-lg tracking-wide">{t("home.secondary")}</Link>
            </div>
            <p className="text-sm text-ink-muted">{t("home.area")}</p>
          </div>
          <WellnessArt variant={0} className="aspect-[4/3] w-full rounded-[2rem] shadow-lift lg:aspect-[5/6]" />
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading eyebrow={t("home.introEyebrow")} title={t("home.introTitle")} />
          <p className="text-lg leading-relaxed text-ink-muted">{t("home.introBody")}</p>
        </div>
      </section>

      <section className="bg-brand-lilac py-16 sm:py-24">
        <div className="container-page space-y-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow={t("home.featuredEyebrow")} title={t("home.featuredTitle")} />
            <Link to="/services" className="btn-secondary shrink-0">{t("home.secondary")}</Link>
          </div>
          {loading || !catalog ? (
            <Spinner label={t("common.loading")} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.services.map((s, i) => <ServiceCard key={s.id} service={s} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {catalog && catalog.enhancements.length > 0 && (
        <section className="container-page py-16 sm:py-24">
          <SectionHeading eyebrow={t("home.enhancementsEyebrow")} title={t("home.enhancementsTitle")} lead={t("enhancements.lead")} />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {catalog.enhancements.map((e) => (
              <Link key={e.id} to={`/enhancements#${e.slug}`} className="card flex flex-col gap-3 p-6 transition-shadow hover:shadow-lift">
                <Sparkles className="h-6 w-6 text-brand-royal" aria-hidden />
                <h3 className="text-2xl">{pick(e as unknown as Record<string, unknown>, "name")}</h3>
                <p className="leading-relaxed text-ink-muted">{pick(e as unknown as Record<string, unknown>, "description")}</p>
                <p className="mt-auto text-sm font-medium text-brand-deep">
                  {e.price_cents !== null && e.added_minutes !== null ? `+${e.added_minutes} min · +${money(e.price_cents, locale)}` : t("common.pricingSoon")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading eyebrow={t("home.whyEyebrow")} title={t("home.whyTitle")} center />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {why.map(([Icon, key]) => {
              const [title, body] = tl<[string, string]>(`home.why.${key}`);
              return (
                <li key={key} className="card h-full p-6">
                  <Icon className="h-6 w-6 text-brand-royal" aria-hidden />
                  <h3 className="mt-4 text-xl">{title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {catalog && (
        <section className="container-page pb-16">
          <p className="mx-auto max-w-3xl rounded-2xl bg-brand-soft/70 px-6 py-5 text-center leading-relaxed text-brand-deep">
            {pick(catalog.settings.content as unknown as Record<string, unknown>, "lotion")}
          </p>
        </section>
      )}

      <section className="px-5 pb-16">
        <div className="container-page rounded-[2rem] bg-brand-deep px-6 py-14 text-center text-white sm:py-20">
          <LotusMark className="mx-auto h-12 w-auto opacity-90" />
          <h2 className="mt-5 text-4xl text-white sm:text-5xl">{t("home.ctaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-brand-soft">{t("home.ctaBody")}</p>
          <Link to="/book" className="btn-light btn-lg mt-8 tracking-wide">{t("home.primary")}</Link>
        </div>
      </section>

      {catalog && (
        <section className="container-page pb-20">
          <h2 className="mb-6 text-3xl">{t("home.contactTitle")}</h2>
          <ContactDetails />
        </section>
      )}
    </>
  );
}
