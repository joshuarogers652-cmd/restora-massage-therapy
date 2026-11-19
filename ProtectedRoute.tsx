import { type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { loginUrl } from "@/services/auth";
import type { Role } from "@/types";
import { Spinner } from "@/components/ui";

/**
 * Hides pages from people without the right role. This is a convenience only:
 * every API call is authorized again on the server.
 */
export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { loading, principal, me, hasRole, error } = useAuth();
  const { t } = useI18n();
  if (loading) return <Spinner label={t("common.loading")} />;
  if (!principal) {
    return (
      <div className="container-page flex justify-center py-20">
        <div className="card w-full max-w-md space-y-5 p-8 text-center">
          <LogIn className="mx-auto h-9 w-9 text-brand-royal" aria-hidden />
          <h1 className="text-3xl">{t("auth.loginTitle")}</h1>
          <p className="text-ink-muted">{t("account.signInPrompt")}</p>
          <a className="btn-primary btn-lg w-full" href={loginUrl()}>{t("auth.loginButton")}</a>
        </div>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-lg">{error ? t(`errors.${error}`) : t("common.error")}</p>
      </div>
    );
  }
  if (roles && !hasRole(...roles)) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl">{t("errors.FORBIDDEN")}</h1>
      </div>
    );
  }
  return <>{children}</>;
}
