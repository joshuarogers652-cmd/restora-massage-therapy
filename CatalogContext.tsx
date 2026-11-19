import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/services/api";
import type { Catalog } from "@/types";

type CatalogState = { catalog: Catalog | null; loading: boolean; error: ApiError | null; reload: () => Promise<void> };
const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await api.get<Catalog>("catalog"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "ERROR", "Error"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return <CatalogContext.Provider value={{ catalog, loading, error, reload }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside CatalogProvider");
  return ctx;
}
