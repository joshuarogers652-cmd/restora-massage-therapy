import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ZodError } from "zod";
import { ensureMigrated } from "./database/migrate";

export { HttpError } from "./errors";
import { HttpError } from "./errors";

// Static Web Apps global headers do not apply to API responses, so the API sets its own.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

export function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponseInit {
  return { status, headers: { ...SECURITY_HEADERS, ...headers }, body: JSON.stringify(body) };
}
export const ok = (body: unknown) => json(200, body);
export const created = (body: unknown) => json(201, body);

export type Handler = (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit>;
export type RouteDef = {
  name: string;
  route: string;
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
  handler: Handler;
  /** Skip automatic migration (health check reports migration state itself). */
  skipMigrate?: boolean;
};

/** Every registered route, so the local development server can serve them too. */
export const registry: RouteDef[] = [];

export function wrap(def: RouteDef): Handler {
  return async (req, ctx) => {
    try {
      if (!def.skipMigrate) await ensureMigrated();
      return await def.handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json(err.status, { error: { code: err.code, message: err.message, details: err.details } });
      }
      if (err instanceof ZodError) {
        return json(400, {
          error: {
            code: "VALIDATION",
            message: "Some fields are missing or invalid.",
            details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        });
      }
      const e = err as { message?: string; stack?: string };
      ctx.error(`[${def.name}] ${e.message}\n${e.stack ?? ""}`);
      return json(500, { error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } });
    }
  };
}

export function register(def: RouteDef) {
  registry.push(def);
  app.http(def.name, { route: def.route, methods: def.methods, authLevel: "anonymous", handler: wrap(def) });
}

export async function readJson<T = unknown>(req: HttpRequest): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  if (text.length > 200_000) throw new HttpError(413, "TOO_LARGE");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "BAD_JSON", "The request body is not valid JSON.");
  }
}
