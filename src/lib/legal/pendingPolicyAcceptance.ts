import type { PolicyAcceptanceInput } from "../../domain/legal/policyAcceptance";

// Sign-in leaves the page (OAuth and magic links are redirects), so the
// checkbox state is gone by the time the user is authenticated. The intent is
// parked here and recorded once the user is authenticated.

const STORAGE_KEY = "creatorhub.pendingPolicyAcceptance";

// A magic link is used within minutes; a day is generous. Older intent is
// dropped and the user is simply asked again.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingPolicyAcceptance = {
  policies: PolicyAcceptanceInput[];
  savedAt: number;
};

const isPolicyInput = (value: unknown): value is PolicyAcceptanceInput =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as PolicyAcceptanceInput).policyType === "string" &&
  typeof (value as PolicyAcceptanceInput).policyVersion === "string";

export const savePendingPolicyAcceptance = (
  policies: PolicyAcceptanceInput[],
  now: number = Date.now(),
): void => {
  try {
    const pending: PendingPolicyAcceptance = { policies, savedAt: now };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The
    // re-ask banner covers this case after sign-in.
  }
};

export const readPendingPolicyAcceptance = (
  now: number = Date.now(),
): PendingPolicyAcceptance | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingPolicyAcceptance>;

    const isValid =
      typeof parsed.savedAt === "number" &&
      Array.isArray(parsed.policies) &&
      parsed.policies.length > 0 &&
      parsed.policies.every(isPolicyInput);

    if (!isValid || now - (parsed.savedAt as number) > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed as PendingPolicyAcceptance;
  } catch {
    return null;
  }
};

export const clearPendingPolicyAcceptance = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
};
