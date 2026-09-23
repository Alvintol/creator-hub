import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../providers/AuthProvider";

type IssueListingRequestPaymentRefundInput = {
  paymentId: string;
  baseRefundCents: number;
  reason: string;
  tipRefundCents?: number;
  contributionRefundCents?: number;
  tipContributionOverrideReason?: "mistaken" | "duplicate" | "unauthorised";
};

type IssueListingRequestPaymentRefundResult = {
  refund_id: string;
  payment_id: string;
  status: string;
  cumulative_base_refunded_cents: number;
  buyer_fee_refund_cents: number;
  creator_fee_reversal_cents: number;
  listing_request_id: string;
  request_status: string;
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

const getJsonResponse = async <Data,>(response: Response): Promise<Data> => {
  const json = (await response.json()) as Data & { error?: string };

  if (!response.ok) {
    throw new Error(json.error || `Refund failed (${response.status})`);
  }

  return json;
};

// launch-scope.md section 6.1: admin-only. Goes through api/server.js
// (not a Postgres RPC directly) because issuing the refund has to call the
// live Stripe API on the creator's connected account -- the RPC it calls
// afterward (apply_refunded_listing_request_payment) is what actually
// writes the ledger, matching the pattern documented on that route.
export const useAdminIssueListingRequestPaymentRefund = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (
      input: IssueListingRequestPaymentRefundInput,
    ): Promise<{ refund: IssueListingRequestPaymentRefundResult }> => {
      const token = session?.access_token;

      if (!token) {
        throw new Error("You must be signed in to issue a refund.");
      }

      const response = await fetch(`${getApiBase()}/api/stripe/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId: input.paymentId,
          baseRefundCents: input.baseRefundCents,
          reason: input.reason,
          tipRefundCents: input.tipRefundCents ?? 0,
          contributionRefundCents: input.contributionRefundCents ?? 0,
          tipContributionOverrideReason:
            input.tipContributionOverrideReason ?? null,
        }),
      });

      return getJsonResponse<{ refund: IssueListingRequestPaymentRefundResult }>(
        response,
      );
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminPaymentIssues"] }),
        queryClient.invalidateQueries({ queryKey: ["listingRequestPayments"] }),
        queryClient.invalidateQueries({ queryKey: ["listingRequestPayment"] }),
        queryClient.invalidateQueries({ queryKey: ["adminRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["buyerRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["creatorRequest"] }),
      ]);
    },
  });
};
