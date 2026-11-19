import { FileWarning } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function Legal({ kind }: { kind: "privacy" | "terms" }) {
  const { t, tl } = useI18n();
  const sections = tl<[string, string][]>(`legal.${kind}`);
  return (
    <div className="container-page max-w-3xl space-y-8 py-14 sm:py-20">
      <h1 className="text-4xl sm:text-5xl">{t(kind === "privacy" ? "legal.privacyTitle" : "legal.termsTitle")}</h1>
      <p className="flex gap-3 rounded-2xl bg-caution-bg px-5 py-4 text-caution-ink"><FileWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{t("legal.draft")}</p>
      {sections.map(([h, b]) => (
        <section key={h} className="space-y-2"><h2 className="text-2xl">{h}</h2><p className="leading-relaxed">{b}</p></section>
      ))}
    </div>
  );
}
