/**
 * Sign-in is handled by Azure Static Web Apps (/.auth/*). The provider name is
 * "aad" for both the built-in Microsoft sign-in and a Microsoft Entra External ID
 * registration (see docs/AZURE_DEPLOYMENT.md, "Authentication").
 */
export const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || "aad";

export type ClientPrincipal = { identityProvider: string; userId: string; userDetails: string; userRoles: string[] };

export async function fetchPrincipal(): Promise<ClientPrincipal | null> {
  try {
    const res = await fetch("/.auth/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { clientPrincipal: ClientPrincipal | null };
    return data.clientPrincipal;
  } catch {
    return null;
  }
}

export function loginUrl(returnTo = window.location.pathname + window.location.search) {
  return `/.auth/login/${AUTH_PROVIDER}?post_login_redirect_uri=${encodeURIComponent(returnTo)}`;
}

export function logoutUrl() {
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent("/")}`;
}
