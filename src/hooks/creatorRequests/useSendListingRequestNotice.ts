import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { sendListingRequestNoticeEmail } from "./listingRequestNoticeEmail";

type SendNoticeResult = {
  notice_id: string;
  notice_type: "first" | "final";
  recipient_user_id: string;
  sent_at: string;
  expires_at: string;
};

const invalidateNoticeQueries = async (
  queryClient: ReturnType<typeof useQueryClient>
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["listingRequestNotices"] }),
    queryClient.invalidateQueries({ queryKey: ["buyerRequest"] }),
    queryClient.invalidateQueries({ queryKey: ["creatorRequest"] }),
    queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
    queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
  ]);

// Sprint 6 (launch-scope.md section 7): the waiting party's first notice.
// The 7-day clock starts server-side, at send_listing_request_first_notice's
// own now() -- this hook does not compute or pass any deadline.
export const useSendListingRequestFirstNotice = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      requestedAction,
    }: {
      requestId: string;
      requestedAction: string;
    }): Promise<SendNoticeResult> => {
      const { data, error } = await supabase.rpc(
        "send_listing_request_first_notice",
        { p_request_id: requestId, p_requested_action: requestedAction }
      );

      if (error) {
        throw new Error(error.message || "The notice could not be sent.");
      }

      const result = (Array.isArray(data) ? data[0] : null) as SendNoticeResult | null;

      if (!result?.notice_id) {
        throw new Error("The notice could not be sent.");
      }

      await sendListingRequestNoticeEmail({
        noticeId: result.notice_id,
        accessToken: session?.access_token,
      });

      return result;
    },

    onSuccess: async () => {
      await invalidateNoticeQueries(queryClient);
    },
  });
};

// The same sender's final notice, once the first has actually expired --
// send_listing_request_final_notice refuses server-side otherwise, so this
// hook does not duplicate that check; the UI only needs
// canSendFinalNotice (src/domain/listings/listingRequestNotices.ts) to
// decide whether to show the action at all.
export const useSendListingRequestFinalNotice = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
    }: {
      requestId: string;
    }): Promise<SendNoticeResult> => {
      const { data, error } = await supabase.rpc(
        "send_listing_request_final_notice",
        { p_request_id: requestId }
      );

      if (error) {
        throw new Error(error.message || "The final notice could not be sent.");
      }

      const result = (Array.isArray(data) ? data[0] : null) as SendNoticeResult | null;

      if (!result?.notice_id) {
        throw new Error("The final notice could not be sent.");
      }

      await sendListingRequestNoticeEmail({
        noticeId: result.notice_id,
        accessToken: session?.access_token,
      });

      return result;
    },

    onSuccess: async () => {
      await invalidateNoticeQueries(queryClient);
    },
  });
};
