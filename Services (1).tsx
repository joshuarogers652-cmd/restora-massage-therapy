import { ServiceCard } from "@/components/ServiceCard";
import { SectionHeading, Spinner, Alert } from "@/components/ui";
import { useCatalog } from "@/contexts/CatalogContext";
import { useI18n } from "@/contexts/I18nContext";

export default function Services() {
  const { t, pick } = useI18n();
  const { catalog, loading, error } = useCatalog();
  return (
    <div className="container-page space-y-12 py-14 sm:py-20">
      <SectionHeading as="h1" eyebrow={t("services.eyebrow")} title={t("services.title")} lead={t("services.lead")} />
      {error && <Alert tone="error">{t(`errors.${error.code}`) !== `errors.${error.code}` ? t(`errors.${error.code}`) : t("common.error")}</Alert>}
      {loading || !catalog ? (
        !error && <Spinner label={t("common.loading")} />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.services.map((s, i) => <ServiceCard key={s.id} service={s} index={i} />)}
          </div>
          <div className="space-y-2 rounded-2xl bg-brand-soft/70 px-6 py-5 leading-relaxed text-brand-deep">
            <p>{pick(catalog.settings.content as unknown as Record<string, unknown>, "lotion")}</p>
            <p className="text-ink-muted">{t("services.notOffered")}</p>
          </div>
        </>
      )}
    </div>
  );
}
