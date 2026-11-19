import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/services/api";
import { Alert, Spinner } from "@/components/ui";

export function useAdmin<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api.get<T>(path).then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

export function Loadable<T>({ state, children }: { state: { data: T | null; error: string | null }; children: (d: T) => ReactNode }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (!state.data) return <Spinner label="Loading…" />;
  return <>{children(state.data)}</>;
}

export function useAction() {
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ tone: "success", text: ok });
      return true;
    } catch (e) {
      const err = e as ApiError;
      const details = Array.isArray(err.details) ? ` (${(err.details as { path?: string; message?: string }[]).map((d) => `${d.path ?? ""} ${d.message ?? ""}`.trim()).join("; ")})` : "";
      setMsg({ tone: "error", text: (err.message ?? "Something went wrong.") + details });
      return false;
    }
  }, []);
  const banner = msg ? <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert> : null;
  return { run, banner, setMsg };
}

export const usd = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export const dollarsToCents = (s: string) => (s.trim() === "" ? null : Math.round(Number(s) * 100));
export const centsToDollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
export const when = (iso: string | null, tz = "America/Chicago") =>
  iso ? new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
