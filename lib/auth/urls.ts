/**
 * Shared auth URL helpers used by server actions and API routes.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * Returns configured site url.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns unknown
 */
export function getConfiguredSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!raw) {
    return null;
  }
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return trimTrailingSlash(withProtocol);
}

/**
 * Builds auth redirect.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns unknown
 */
export function buildAuthRedirect(pathWithQuery: string) {
  const base = getConfiguredSiteUrl();
  if (!base) {
    return undefined;
  }
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `${base}${path}`;
}

export const getInviteRedirectUrl = () => buildAuthRedirect("/auth/login");

export const getPasswordResetRedirectUrl = () =>
  buildAuthRedirect("/auth/callback?next=/auth/update-password");
