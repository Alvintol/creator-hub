import { supabase } from "../../lib/supabaseClient";

export const CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE =
  "Connect and complete Stripe payout onboarding before publishing paid listings.";

// Free listings never take a payment, so they do not need a connected account.
// The database trigger is the real boundary
// (20260921_116_exempt_free_listings_from_payout_readiness.sql); this check only
// exists to fail earlier with a clearer message. It reads is_free from the row
// rather than accepting it from the caller, so it cannot be waved through.
export const requireCreatorPaymentAccountReadyForPublishing = async (
  userId: string,
  listingId: string,
): Promise<void> => {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("is_free")
    .eq("id", listingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (listingError) {
    throw listingError;
  }

  if (listing?.is_free === true) {
    return;
  }

  const { data, error } = await supabase.rpc(
    "has_ready_creator_payment_account",
    {
      target_user_id: userId,
    },
  );

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new Error(CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE);
  }
};
