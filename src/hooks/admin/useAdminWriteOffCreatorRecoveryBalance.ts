import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

type AdminWriteOffCreatorRecoveryBalanceInput = {
  creatorUserId: string;
  reason: string;
};

// launch-scope.md checklist: "Admin write-off action for an unrecoverable
// balance." admin_write_off_creator_recovery_balance checks admin_roles
// itself, so this is a plain RPC call like every other admin action against
// listing_request_payments-adjacent state.
export const useAdminWriteOffCreatorRecoveryBalance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      creatorUserId,
      reason,
    }: AdminWriteOffCreatorRecoveryBalanceInput) => {
      const { data, error } = await supabase.rpc(
        "admin_write_off_creator_recovery_balance",
        {
          p_creator_user_id: creatorUserId,
          p_reason: reason,
        },
      );

      if (error) {
        throw new Error(error.message || "This balance could not be written off.");
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creatorRecoveryBalance"] }),
        queryClient.invalidateQueries({ queryKey: ["creatorRecoveryEntries"] }),
      ]);
    },
  });
};
