import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type AdminProfileModerationInput = {
  profileUserId: string;
  moderationReportId?: string | null;
  adminNote?: string | null;
};

type AdminProfileModerationResult = {
  profile_user_id: string;
  previous_is_under_review: boolean;
  new_is_under_review: boolean;
  changed: boolean;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Profile moderation action failed.";
};

// Runs one of the admin-only profile moderation RPCs
const runProfileModerationRpc = async (
  rpcName:
    | "admin_mark_profile_under_review"
    | "admin_clear_profile_review_flag",
  input: AdminProfileModerationInput
): Promise<AdminProfileModerationResult> => {
  const { data, error } = await supabase.rpc(rpcName, {
    p_profile_user_id: input.profileUserId,
    p_moderation_report_id: input.moderationReportId ?? null,
    p_admin_note: input.adminNote ?? null,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data as AdminProfileModerationResult;
};

export const useAdminMarkProfileUnderReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminProfileModerationInput) =>
      runProfileModerationRpc("admin_mark_profile_under_review", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      queryClient.invalidateQueries({
        queryKey: ["adminModerationReportSummary"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};

export const useAdminClearProfileReviewFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminProfileModerationInput) =>
      runProfileModerationRpc("admin_clear_profile_review_flag", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      queryClient.invalidateQueries({
        queryKey: ["adminModerationReportSummary"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};