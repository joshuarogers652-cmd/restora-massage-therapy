import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/services/api";
import { fetchPrincipal, type ClientPrincipal } from "@/services/auth";
import type { Me, Role } from "@/types";

type AuthState = {
  loading: boolean;
  principal: ClientPrincipal | null;
  me: Me | null;
  error: string | null;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [principal, setPrincipal] = useState<ClientPrincipal | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = await fetchPrincipal();
    setPrincipal(p);
    if (p) {
      try {
        setMe(await api.get<Me>("me"));
      } catch (e) {
        setMe(null);
        setError(e instanceof ApiError ? e.code : "ERROR");
      }
    } else {
      setMe(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!me && (me.user.roles.includes("admin") || roles.some((r) => me.user.roles.includes(r))),
    [me],
  );

  return <AuthContext.Provider value={{ loading, principal, me, error, refresh, hasRole }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
