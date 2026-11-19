import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/contexts/I18nContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { useAuth } from "@/contexts/AuthContext";
import { logoutUrl } from "@/services/auth";

export function Footer() {
  const { t, pick } = useI18n();
  const { catalog } = useCatalog();
  const { me, hasRole } = useAuth();
  const b = catalog?.settings.business;
  const content = catalog?.settings.content as unknown as Record<string, unknown> | undefined;
  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo descriptor={t("brand.descriptor")} />
          <p className="font-display text-xl italic text-brand-royal">{t("brand.tagline")}</p>
          {b && <p className="text-sm text-ink-muted">{pick(b as unknown as Record<string, unknown>, "area")}</p>}
          {content && <p className="text-sm text-ink-muted">{pick(content, "lotion")}</p>}
        </div>
        <nav aria-label={t("footer.explore")}>
          <h2 className="eyebrow mb-4 font-sans">{t("footer.explore")}</h2>
          <ul className="space-y-2.5 text-[0.95rem]">
            <li><Link className="hover:text-brand-deep hover:underline" to="/services">{t("nav.services")}</Link></li>
            <li><Link className="hover:text-brand-deep hover:underline" to="/enhancements">{t("nav.enhancements")}</Link></li>
            <li><Link className="hover:text-brand-deep hover:underline" to="/about">{t("nav.about")}</Link></li>
            <li><Link className="hover:text-brand-deep hover:underline" to="/contact">{t("nav.contact")}</Link></li>
            <li><Link className="hover:text-brand-deep hover:underline" to="/book">{t("nav.book")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("footer.legal")}>
          <h2 className="eyebrow mb-4 font-sans">{t("footer.legal")}</h2>
          <ul className="space-y-2.5 text-[0.95rem]">
            <li><Link className="hover:text-brand-deep hover:underline" to="/privacy">{t("footer.privacy")}</Link></li>
            <li><Link className="hover:text-brand-deep hover:underline" to="/terms">{t("footer.terms")}</Link></li>
            {me ? (
              <>
                <li><Link className="hover:text-brand-deep hover:underline" to="/account">{t("nav.account")}</Link></li>
                {hasRole("therapist") && <li><Link className="hover:text-brand-deep hover:underline" to="/therapist">{t("nav.therapist")}</Link></li>}
                {hasRole("office_manager") && <li><Link className="hover:text-brand-deep hover:underline" to="/admin">{t("nav.admin")}</Link></li>}
                <li><a className="hover:text-brand-deep hover:underline" href={logoutUrl()}>{t("nav.signOut")}</a></li>
              </>
            ) : (
              <li><Link className="hover:text-brand-deep hover:underline" to="/login">{t("nav.signIn")}</Link></li>
            )}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} RESTORA Massage Therapy. {t("footer.rights")}</p>
          <p>{t("footer.professional")}</p>
        </div>
      </div>
    </footer>
  );
}
