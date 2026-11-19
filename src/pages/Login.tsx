import { Link, Navigate, useSearchParams } from "react-router-dom";
import { LogIn } from "lucide-react";
import { LotusMark } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { loginUrl } from "@/services/auth";

export default function Login() {
  const { t } = useI18n();
  const { me } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") && params.get("next")!.startsWith("/") ? params.get("next")! : "/account";
  if (me) return <Navigate to={next} replace />;
  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <div className="card w-full max-w-md space-y-6 p-8 text-center">
        <LotusMark className="mx-auto h-12 w-auto" />
        <h1 className="text-3xl sm:text-4xl">{t("auth.loginTitle")}</h1>
        <p className="leading-relaxed text-ink-muted">{t("auth.loginLead")}</p>
        <a href={loginUrl(next)} className="btn-primary btn-lg w-full"><LogIn className="h-5 w-5" aria-hidden />{t("auth.loginButton")}</a>
        <p className="text-sm text-ink-muted">{t("auth.noAccount")} <Link to="/register" className="font-medium text-brand-deep underline-offset-2 hover:underline">{t("auth.registerButton")}</Link></p>
        <p className="text-xs text-ink-muted"><Link to="/privacy" className="hover:underline">{t("auth.privacy")}</Link></p>
      </div>
    </div>
  );
}
