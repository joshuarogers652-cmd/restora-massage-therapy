import { Link, Navigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { LotusMark } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { loginUrl } from "@/services/auth";

/** Account creation happens at the sign-in provider; RESTORA then asks for profile details. */
export default function Register() {
  const { t, tl } = useI18n();
  const { me } = useAuth();
  if (me) return <Navigate to="/account?tab=profile" replace />;
  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <div className="card w-full max-w-lg space-y-6 p-8">
        <LotusMark className="h-12 w-auto" />
        <h1 className="text-3xl sm:text-4xl">{t("auth.registerTitle")}</h1>
        <p className="leading-relaxed text-ink-muted">{t("auth.registerLead")}</p>
        <ol className="space-y-3">
          {tl<string[]>("auth.registerSteps").map((s, i) => (
            <li key={s} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-deep">{i + 1}</span><span className="pt-0.5">{s}</span></li>
          ))}
        </ol>
        <a href={loginUrl("/account?tab=profile")} className="btn-primary btn-lg w-full"><UserPlus className="h-5 w-5" aria-hidden />{t("auth.registerButton")}</a>
        <p className="text-center text-sm text-ink-muted">{t("auth.haveAccount")} <Link to="/login" className="font-medium text-brand-deep hover:underline">{t("nav.signIn")}</Link></p>
      </div>
    </div>
  );
}
