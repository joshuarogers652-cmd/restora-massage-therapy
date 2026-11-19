import { Link } from "react-router-dom";
import { LotusMark } from "@/components/brand/Logo";
import { useI18n } from "@/contexts/I18nContext";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
      <LotusMark className="h-12 w-auto" />
      <h1 className="text-4xl">{t("notFound.title")}</h1>
      <p className="max-w-md text-ink-muted">{t("notFound.body")}</p>
      <Link to="/" className="btn-primary">{t("notFound.home")}</Link>
    </div>
  );
}
