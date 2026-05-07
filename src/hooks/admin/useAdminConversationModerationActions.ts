import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type AdminConversationModerationInput = {
  conversationId: string;
  moderationReportId?: string | null;
  adminNote?: string | null;
};

type AdminConversationModerationResult = {
  conversation_id: string;
  previous_status: string;
  new_status: string;
  changed: boolean;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Conversation moderation action failed.";
};

// Runs one of the admin-only conversation moderation RPCs
const runConversationModerationRpc = async (
  rpcName: "admin_lock_conversation" | "admin_reopen_conversation",
  input: AdminConversationModerationInput
): Promise<AdminConversationModerationResult> => {
  const { data, error } = await supabase.rpc(rpcName, {
    p_conversation_id: input.conversationId,
    p_moderation_report_id: input.moderationReportId ?? null,
    p_admin_note: input.adminNote ?? null,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data as AdminConversationModerationResult;
};

export const useAdminLockConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminConversationModerationInput) =>
      runConversationModerationRpc("admin_lock_conversation", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};

export const useAdminReopenConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminConversationModerationInput) =>
      runConversationModerationRpc("admin_reopen_conversation", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};