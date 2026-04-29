import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ConversationCloseReasonCode } from "../../domain/conversations/conversations";

type CloseConversationInput = {
  conversationId: string;
  reasonCode: ConversationCloseReasonCode;
  reasonDetails?: string;
};

const normaliseDetails = (value?: string) => value?.trim() ?? "";

export const useCloseConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CloseConversationInput) => {
      const details = normaliseDetails(input.reasonDetails);

      if (!input.reasonCode) {
        throw new Error("Please choose a reason for ending the conversation.");
      }

      if (input.reasonCode === "other" && details.length < 10) {
        throw new Error("Please add at least 10 characters of detail when choosing Other.");
      }

      if (details.length > 1000) {
        throw new Error("Additional details must be 1000 characters or less.");
      }

      const { data, error } = await supabase.rpc("close_conversation", {
        p_conversation_id: input.conversationId,
        p_reason_code: input.reasonCode,
        p_reason_details: details || null,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
      ]);
    },
  });
};