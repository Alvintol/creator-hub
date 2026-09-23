import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestPaymentRow } from "./useListingRequestPayments";

type SetListingRequestPaymentTipAndSupportInput = {
  paymentId: string;
  creatorTipCents: number;
  platformSupportCents: number;
};

// launch-scope.md section 4: both default to zero and must be
// affirmatively chosen. This RPC is the write path; the checkout page
// gates opening Stripe Checkout on the buyer having gone through this step
// at least once (see ListingRequestPaymentCheckout.tsx), even to confirm
// zero of each.
export const useSetListingRequestPaymentTipAndSupport = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
      creatorTipCents,
      platformSupportCents,
    }: SetListingRequestPaymentTipAndSupportInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to continue.");
      }

      const { data, error } = await supabase.rpc(
        "set_listing_request_payment_tip_and_support",
        {
          p_payment_id: paymentId,
          p_creator_tip_cents: creatorTipCents,
          p_platform_support_cents: platformSupportCents,
        },
      );

      if (error) {
        throw new Error(error.message || "This could not be saved.");
      }

      return data as ListingRequestPaymentRow;
    },

    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listingRequestPayments"] }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestPayment", data.id],
        }),
      ]);
    },
  });
};
