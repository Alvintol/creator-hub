import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type RequestBuyerImageUploadInput = {
  conversationId: string;
  requestNote?: string;
};

type ConversationIdInput = {
  conversationId: string;
};

const normaliseNote = (value?: string) => value?.trim() ?? "";

const invalidateConversationQueries = async (
  queryClient: ReturnType<typeof useQueryClient>
) => {
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
};

export const useRequestBuyerImageUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestBuyerImageUploadInput) => {
      const requestNote = normaliseNote(input.requestNote);

      if (requestNote.length > 1000) {
        throw new Error("Request note must be 1000 characters or less.");
      }

      const { data, error } = await supabase.rpc("request_buyer_image_upload", {
        p_conversation_id: input.conversationId,
        p_request_note: requestNote || null,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async () => {
      await invalidateConversationQueries(queryClient);
    },
  });
};

export const useApproveBuyerImageUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConversationIdInput) => {
      const { data, error } = await supabase.rpc("approve_buyer_image_upload", {
        p_conversation_id: input.conversationId,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async () => {
      await invalidateConversationQueries(queryClient);
    },
  });
};

export const useRevokeBuyerImageUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConversationIdInput) => {
      const { data, error } = await supabase.rpc("revoke_buyer_image_upload", {
        p_conversation_id: input.conversationId,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async () => {
      await invalidateConversationQueries(queryClient);
    },
  });
};