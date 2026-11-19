import type { HttpRequest } from "@azure/functions";
import { HttpError } from "../errors";
import { one, q, tx } from "../database/db";

export type Role = "client" | "therapist" | "office_manager" | "admin";

export type ClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
};

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  locale: "en" | "es";
  roles: Role[];
  clientId: string | null;
  therapistId: string | null;
};

/**
 * Azure Static Web Apps signs users in and forwards their identity to managed
 * API functions in the `x-ms-client-principal` header (base64 JSON).
 * Roles are NOT taken from that header; they come from our own user_roles table.
 */
export function readPrincipal(req: HttpRequest): ClientPrincipal | null {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return null;
  try {
    const p = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as Partial<ClientPrincipal>;
    if (!p.userId || !p.identityProvider) return null;
    return {
      identityProvider: String(p.identityProvider),
      userId: String(p.userId),
      userDetails: String(p.userDetails ?? ""),
      userRoles: Array.isArray(p.userRoles) ? p.userRoles.map(String) : [],
    };
  } catch {
    return null;
  }
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const cache = new WeakMap<HttpRequest, Promise<CurrentUser | null>>();

/** Find or create the user for this request and load their roles. */
export function currentUser(req: HttpRequest): Promise<CurrentUser | null> {
  let p = cache.get(req);
  if (!p) {
    p = loadUser(req);
    cache.set(req, p);
  }
  return p;
}

async function loadUser(req: HttpRequest): Promise<CurrentUser | null> {
  const principal = readPrincipal(req);
  if (!principal) return null;
  const email = principal.userDetails.includes("@") ? principal.userDetails.trim().toLowerCase() : null;

  const userId = await tx(async (c) => {
    const existing = await one<{ id: string; email: string | null; last_login_at: Date | null; disabled_at: Date | null }>(
      "SELECT id, email, last_login_at, disabled_at FROM users WHERE identity_provider = $1 AND provider_user_id = $2",
      [principal.identityProvider, principal.userId],
      c,
    );
    let id: string;
    if (existing) {
      if (existing.disabled_at) throw new HttpError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
      id = existing.id;
      const stale = !existing.last_login_at || Date.now() - existing.last_login_at.getTime() > 60 * 60 * 1000;
      if (stale || (email && email !== existing.email)) {
        await q("UPDATE users SET last_login_at = now(), email = COALESCE($2, email) WHERE id = $1", [id, email], c);
      }
    } else {
      const row = await one<{ id: string }>(
        `INSERT INTO users (identity_provider, provider_user_id, email, display_name, last_login_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (identity_provider, provider_user_id) DO UPDATE SET last_login_at = now()
         RETURNING id`,
        [principal.identityProvider, principal.userId, email, principal.userDetails || null],
        c,
      );
      id = row!.id;
      await q("INSERT INTO user_roles (user_id, role) VALUES ($1, 'client') ON CONFLICT DO NOTHING", [id], c);
    }

    if (email) {
      // First-time owner setup: emails listed in ADMIN_EMAILS become administrators.
      if (adminEmails().includes(email)) {
        await q("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [id], c);
      }
      // A therapist profile created by an admin with this email is linked on first sign-in.
      const invited = await one<{ id: string }>(
        "UPDATE therapists SET user_id = $1 WHERE user_id IS NULL AND lower(invite_email) = $2 RETURNING id",
        [id, email],
        c,
      );
      if (invited) {
        await q("INSERT INTO user_roles (user_id, role) VALUES ($1, 'therapist') ON CONFLICT DO NOTHING", [id], c);
        await q(
          "INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, 'therapist.linked', 'therapist', $2)",
          [id, invited.id],
          c,
        );
      }
    }
    return id;
  });

  const row = await one<{
    id: string;
    email: string | null;
    display_name: string | null;
    preferred_locale: "en" | "es";
    roles: Role[];
    client_id: string | null;
    therapist_id: string | null;
  }>(
    `SELECT u.id, u.email, u.display_name, u.preferred_locale,
            COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles,
            (SELECT c.id FROM clients c WHERE c.user_id = u.id) AS client_id,
            (SELECT t.id FROM therapists t WHERE t.user_id = u.id AND t.active) AS therapist_id
       FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE u.id = $1 GROUP BY u.id`,
    [userId],
  );
  return {
    id: row!.id,
    email: row!.email,
    displayName: row!.display_name,
    locale: row!.preferred_locale,
    roles: row!.roles,
    clientId: row!.client_id,
    therapistId: row!.therapist_id,
  };
}

export async function requireUser(req: HttpRequest): Promise<CurrentUser> {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "SIGN_IN_REQUIRED", "Please sign in.");
  return user;
}

export function hasRole(user: CurrentUser, ...roles: Role[]) {
  return user.roles.includes("admin") || roles.some((r) => user.roles.includes(r));
}

export async function requireRole(req: HttpRequest, ...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (!hasRole(user, ...roles)) throw new HttpError(403, "FORBIDDEN", "You don't have access to this.");
  return user;
}

/** Therapist endpoints: the user must be an active, linked therapist (admins may also act). */
export async function requireTherapist(req: HttpRequest) {
  const user = await requireRole(req, "therapist");
  if (!user.therapistId && !user.roles.includes("admin")) {
    throw new HttpError(403, "NO_THERAPIST_PROFILE", "Your therapist profile isn't active yet. Ask the administrator.");
  }
  return user;
}
