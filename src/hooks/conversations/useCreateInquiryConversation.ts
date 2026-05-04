import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ConversationInitiationReasonCode } from "../../domain/conversations/conversations";

type CreateCreatorInquiryInput = {
  creatorUserId: string;
  initiationReasonCode: ConversationInitiationReasonCode;
  initialMessage: string;
};

type CreateListingInquiryInput = {
  listingId: string;
  initiationReasonCode: ConversationInitiationReasonCode;
  initialMessage: string;
};

const normaliseMessage = (value: string) => value.trim();

const validateInitialMessage = (message: string) => {
  if (message.length < 10) {
    throw new Error("Message must be at least 10 characters.");
  }

  if (message.length > 2000) {
    throw new Error("Message must be 2000 characters or less.");
  }
};

export const useCreateCreatorInquiryConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCreatorInquiryInput) => {
      const initialMessage = normaliseMessage(input.initialMessage);
      validateInitialMessage(initialMessage);

      const { data, error } = await supabase.rpc(
        "create_creator_inquiry_conversation",
        {
          p_creator_user_id: input.creatorUserId,
          p_initiation_reason_code: input.initiationReasonCode,
          p_initial_message: initialMessage,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("Conversation could not be created.");
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
      ]);
    },
  });
};

export const useCreateListingInquiryConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateListingInquiryInput) => {
      const initialMessage = normaliseMessage(input.initialMessage);
      validateInitialMessage(initialMessage);

      const { data, error } = await supabase.rpc(
        "create_listing_inquiry_conversation",
        {
          p_listing_id: input.listingId,
          p_initiation_reason_code: input.initiationReasonCode,
          p_initial_message: initialMessage,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("Conversation could not be created.");
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
      ]);
    },
  });
};