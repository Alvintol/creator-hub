import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

// launch-scope.md section 6.5: a boolean-only check, safe for buyer-facing
// UI -- it is the same function the "listing requests buyer insert" RLS
// policy uses (20260922_128), so the UI and the enforcement boundary can
// never disagree about whether a request would be blocked. Never exposes
// the creator's actual outstanding amount.
export const useCreatorHasOutstandingRecoveryBalance = (
  creatorUserId?: string | null,
) =>
  useQuery({
    queryKey: ["creatorHasOutstandingRecoveryBalance", creatorUserId],
    enabled: Boolean(creatorUserId),
    queryFn: async (): Promise<boolean> => {
      if (!creatorUserId) return false;

      const { data, error } = await supabase.rpc(
        "creator_has_outstanding_recovery_balance",
        { p_creator_user_id: creatorUserId },
      );

      if (error) {
        throw error;
      }

      return Boolean(data);
    },
  });
