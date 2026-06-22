import { supabase } from "../../lib/supabaseClient";

export const CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE =
  "Connect and complete Stripe payout onboarding before publishing paid listings.";

export const requireCreatorPaymentAccountReadyForPublishing = async (
  userId: string,
): Promise<void> => {
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