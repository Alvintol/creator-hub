import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../providers/AuthProvider";

type CreateCreatorRecoverySettlementCheckoutInput = {
  amountCents: number;
};

type CreatorRecoverySettlementCheckoutResponse = {
  settlementId: string;
  checkout: {
    sessionId: string;
    clientSecret: string;
  };
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

const getJsonResponse = async <Data,>(response: Response): Promise<Data> => {
  const json = (await response.json()) as Data & { error?: string };

  if (!response.ok) {
    throw new Error(json.error || `Stripe checkout failed (${response.status})`);
  }

  return json;
};

// launch-scope.md section 6.5: "the creator can settle the balance in the
// app at any time, by card." A straight (non-Connect) Stripe Checkout
// session on the platform's own account.
export const useCreateCreatorRecoverySettlementCheckout = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      amountCents,
    }: CreateCreatorRecoverySettlementCheckoutInput): Promise<CreatorRecoverySettlementCheckoutResponse> => {
      const token = session?.access_token;

      if (!token) {
        throw new Error("You must be signed in to settle your balance.");
      }

      const response = await fetch(
        `${getApiBase()}/api/stripe/recovery/settlement-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amountCents }),
        },
      );

      return getJsonResponse<CreatorRecoverySettlementCheckoutResponse>(response);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creatorRecoveryBalance"] });
      await queryClient.invalidateQueries({ queryKey: ["creatorRecoveryEntries"] });
    },
  });
};
