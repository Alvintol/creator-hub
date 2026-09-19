import type { CookiePreferences } from "../../domain/legal/cookiePreferences";

// Privacy-choice storage: necessary, because it is how a refusal is
// remembered (Cookie Policy section 3).
export const COOKIE_PREFERENCES_STORAGE_KEY = "creatorhub.cookiePreferences";

const isCookiePreferences = (value: unknown): value is CookiePreferences => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<CookiePreferences>;

  return (
    typeof candidate.policyVersion === "string" &&
    Array.isArray(candidate.offeredCategories) &&
    typeof candidate.decidedAt === "number" &&
    typeof candidate.expiresAt === "number" &&
    Boolean(candidate.categories) &&
    typeof candidate.categories === "object"
  );
};

export const readCookiePreferences = (): CookiePreferences | null => {
  try {
    const raw = window.localStorage.getItem(COOKIE_PREFERENCES_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    return isCookiePreferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCookiePreferences = (preferences: CookiePreferences): void => {
  try {
    window.localStorage.setItem(
      COOKIE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // If storage is unavailable the choice lasts for this page view only,
    // and optional categories stay off.
  }
};
