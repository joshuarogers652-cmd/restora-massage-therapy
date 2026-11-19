import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { logoutUrl } from "@/services/auth";

export function Header() {
  const { t, locale, setLocale, pick } = useI18n();
  const { me, hasRole } = useAuth();
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const announcement = catalog ? pick(catalog.settings.content as unknown as Record<string, unknown>, "announcement") : "";

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-brand-ivory/95 backdrop-blur">
      {announcement && <div className="bg-brand-deep px-5 py-2 text-center text-sm text-white">{announcement}</div>}
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-3">
        <Link to="/" aria-label="RESTORA Massage Therapy" className="rounded-md">
          <Logo descriptor={t("brand.descriptor")} />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <Navigation />
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "es" : "en")}
            aria-label={t("nav.languageLabel")}
            lang={locale === "en" ? "es" : "en"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft"
          >
            <Globe className="h-4 w-4" aria-hidden />
            {t("nav.language")}
          </button>
          {me ? (
            <Link to={hasRole("therapist") && !hasRole("office_manager") && !me.user.roles.includes("admin") ? "/therapist" : hasRole("office_manager") ? "/admin" : "/account"} className="hidden min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft sm:inline-flex">
              <UserRound className="h-4 w-4" aria-hidden />
              {t("nav.account")}
            </Link>
          ) : (
            <Link to="/login" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft sm:inline-flex">
              {t("nav.signIn")}
            </Link>
          )}
          <Link to="/book" className="btn-primary btn-sm hidden sm:inline-flex">
            {t("nav.book")}
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-deep hover:bg-brand-soft lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("nav.close") : t("nav.menu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-line bg-brand-ivory lg:hidden">
          <nav aria-label="Mobile" className="container-page py-4">
            <Navigation vertical onNavigate={() => setOpen(false)} />
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
              {me ? (
                <>
                  <Link to="/account" className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-brand-soft">{t("nav.account")}</Link>
                  {hasRole("therapist") && <Link to="/therapist" className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-brand-soft">{t("nav.therapist")}</Link>}
                  {hasRole("office_manager") && <Link to="/admin" className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-brand-soft">{t("nav.admin")}</Link>}
                  <a href={logoutUrl()} className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-brand-soft">{t("nav.signOut")}</a>
                </>
              ) : (
                <Link to="/login" className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-brand-soft">{t("nav.signIn")}</Link>
              )}
              <Link to="/book" className="btn-primary btn-lg mt-2">{t("nav.book")}</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
