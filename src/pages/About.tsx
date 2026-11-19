import { Check } from "lucide-react";
import { WellnessArt } from "@/components/brand/WellnessArt";
import { SectionHeading } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";

export default function About() {
  const { t, tl, pick } = useI18n();
  const { catalog } = useCatalog();
  return (
    <>
      <section className="bg-gradient-to-b from-brand-lilac to-brand-ivory">
        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <SectionHeading as="h1" eyebrow={t("about.eyebrow")} title={t("about.title")} lead={t("about.lead")} />
          <WellnessArt variant={2} className="aspect-[4/3] rounded-[2rem] shadow-soft" />
        </div>
      </section>
      <section className="container-page grid gap-12 py-16 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-5">
          <h2 className="text-3xl sm:text-4xl">{t("about.approachTitle")}</h2>
          {tl<string[]>("about.approach").map((p) => <p key={p} className="text-lg leading-relaxed">{p}</p>)}
        </div>
        <div className="space-y-6">
          <div className="card p-7">
            <h2 className="text-2xl">{t("about.standardsTitle")}</h2>
            <ul className="mt-4 space-y-3">
              {tl<string[]>("about.standards").map((s) => (
                <li key={s} className="flex gap-3 leading-relaxed"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-royal" aria-hidden />{s}</li>
              ))}
            </ul>
          </div>
          {catalog && (
            <div className="rounded-card bg-brand-soft/70 p-7">
              <h2 className="text-2xl">{t("about.lotionTitle")}</h2>
              <p className="mt-3 leading-relaxed text-brand-deep">{pick(catalog.settings.content as unknown as Record<string, unknown>, "lotion")}</p>
            </div>
          )}
        </div>
      </section>
      {catalog && catalog.therapists.length > 0 && (
        <section className="bg-brand-lilac py-16">
          <div className="container-page space-y-8">
            <h2 className="text-3xl sm:text-4xl">{t("about.teamTitle")}</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {catalog.therapists.map((th) => (
                <li key={th.id} className="card flex flex-col gap-3 p-6">
                  <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft font-display text-2xl font-semibold text-brand-deep">
                    {th.display_name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                  </span>
                  <h3 className="text-xl">{th.display_name}</h3>
                  {pick(th as unknown as Record<string, unknown>, "bio") && <p className="text-sm leading-relaxed text-ink-muted">{pick(th as unknown as Record<string, unknown>, "bio")}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
