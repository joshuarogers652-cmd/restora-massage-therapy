import { HttpRequest, InvocationContext } from "@azure/functions";
import "../../api/src/index";
import { registry, wrap } from "../../api/src/http";

export type Who = { email: string; provider?: string; claimRoles?: string[] } | null;

/** Calls an API function exactly as Azure would, with the signed-in user's principal header. */
export async function call<T = any>(method: string, path: string, opts: { as?: Who; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const url = new URL(`http://localhost/api/${path.replace(/^\//, "")}`);
  const pathname = url.pathname.replace(/^\/api\//, "");
  for (const def of registry) {
    if (!def.methods.includes(method as never)) continue;
    const names: string[] = [];
    const re = new RegExp(`^${def.route.replace(/\{(\w+)\}/g, (_, n) => (names.push(n), "([^/]+)"))}$`);
    const m = pathname.match(re);
    if (!m) continue;
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.as) {
      const principal = {
        identityProvider: opts.as.provider ?? "aad",
        userId: `id-${opts.as.email}`,
        userDetails: opts.as.email,
        userRoles: ["anonymous", "authenticated", ...(opts.as.claimRoles ?? [])],
      };
      headers["x-ms-client-principal"] = Buffer.from(JSON.stringify(principal)).toString("base64");
    }
    const body = opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
    const req = new HttpRequest({
      method,
      url: url.toString(),
      headers,
      params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])),
      query: Object.fromEntries(url.searchParams),
      body: body !== undefined ? { string: body } : undefined,
    });
    const res = await wrap(def)(req, new InvocationContext({ functionName: def.name }));
    const text = typeof res.body === "string" ? res.body : "";
    return { status: res.status ?? 200, body: (text ? JSON.parse(text) : null) as T, headers: res.headers as Record<string, string> };
  }
  throw new Error(`No route for ${method} ${path}`);
}

export const owner: Who = { email: "owner@restora.test" };
export const therapistA: Who = { email: "maria.therapist@restora.test" };
export const therapistB: Who = { email: "lena.therapist@restora.test" };
export const clientAna: Who = { email: "ana.client@example.test" };
export const clientBen: Who = { email: "ben.client@example.test" };
export const clientCruz: Who = { email: "cruz.client@example.test" };
export const manager: Who = { email: "frontdesk@restora.test" };

/** Next date (YYYY-MM-DD) at least `minDays` ahead that falls on the given weekday (0 = Sunday), in America/Chicago. */
export function nextWeekday(weekday: number, minDays = 2) {
  const now = new Date();
  for (let i = minDays; i < minDays + 14; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
    const ymd = `${local.find((p) => p.type === "year")!.value}-${local.find((p) => p.type === "month")!.value}-${local.find((p) => p.type === "day")!.value}`;
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(local.find((p) => p.type === "weekday")!.value);
    if (wd === weekday) return ymd;
  }
  throw new Error("no date");
}

export const emptyIntake = {
  conditions: [] as string[], allergies: "", skinSensitivities: "", medications: "", injuries: "", surgeries: "",
  pregnant: false, pregnancyWeeks: null, underPhysicianCare: false, physicianClearance: "", pressurePreference: "MEDIUM",
  goals: ["relaxation"], preferences: "", emergencyName: "", emergencyPhone: "",
};
export const profile = (first: string) => ({ firstName: first, lastName: "Testclient", preferredName: null, phone: "281-555-0100", dateOfBirth: "1990-05-01" });
