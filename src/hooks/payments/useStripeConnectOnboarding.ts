import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";

type StartStripeConnectInput = {
  country: string;
  defaultCurrency: string;
};

type StripeConnectAccountResponse = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string;
  defaultCurrency: string;
};

type StartStripeConnectResponse = {
  url: string;
  account: StripeConnectAccountResponse;
};

type SyncStripeConnectResponse = {
  account: StripeConnectAccountResponse;
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
  actionUrl?: string;
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

const getJsonResponse = async <Data,>(response: Response): Promise<Data> => {
  const json = (await response.json()) as Data & ApiErrorResponse;

  if (!response.ok) {
    throw new StripeConnectApiError(
      json.error || `Stripe connect failed (${response.status})`,
      {
        code: json.code,
        actionUrl: json.actionUrl,
      },
    );
  }

  return json;
};

export class StripeConnectApiError extends Error {
  code?: string;
  actionUrl?: string;

  constructor(message: string, options?: { code?: string; actionUrl?: string }) {
    super(message);
    this.name = "StripeConnectApiError";
    this.code = options?.code;
    this.actionUrl = options?.actionUrl;
  }
}

export const getStripeConnectErrorActionUrl = (
  error: unknown,
): string | null =>
  error instanceof StripeConnectApiError ? error.actionUrl ?? null : null;

export const useStartStripeConnectOnboarding = () => {
  const { session, user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: StartStripeConnectInput,
    ): Promise<StartStripeConnectResponse> => {
      const token = session?.access_token;

      if (!token) {
        throw new Error("You must be signed in to connect Stripe payouts.");
      }

      const response = await fetch(`${getApiBase()}/api/stripe/connect/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: input.country.trim().toUpperCase(),
          defaultCurrency: input.defaultCurrency.trim().toLowerCase(),
        }),
      });

      return getJsonResponse<StartStripeConnectResponse>(response);
    },
    mutationKey: ["startStripeConnectOnboarding", user?.id ?? null],
  });
};

export const useSyncStripeConnectAccount = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<SyncStripeConnectResponse> => {
      const token = session?.access_token;

      if (!token) {
        throw new Error("You must be signed in to refresh Stripe payouts.");
      }

      const response = await fetch(`${getApiBase()}/api/stripe/connect/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return getJsonResponse<SyncStripeConnectResponse>(response);
    },
    mutationKey: ["syncStripeConnectAccount", user?.id ?? null],
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["creatorPaymentAccount", user?.id ?? null],
      });
    },
  });
};