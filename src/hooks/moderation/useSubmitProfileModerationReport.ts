import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ModerationReportReasonCode } from "../../domain/moderation/moderationReports";
import { supabase } from "../../lib/supabaseClient";

type SubmitProfileModerationReportInput = {
  profileUserId: string;
  reasonCode: ModerationReportReasonCode;
  reasonDetails?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Profile report could not be submitted.";
};

// Submits a profile report while the RPC derives the reported user safely
const submitProfileModerationReport = async (
  input: SubmitProfileModerationReportInput
): Promise<string> => {
  const { data, error } = await supabase.rpc(
    "submit_profile_moderation_report",
    {
      p_profile_user_id: input.profileUserId,
      p_reason_code: input.reasonCode,
      p_reason_details: input.reasonDetails?.trim() || null,
    }
  );

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data as string;
};

export const useSubmitProfileModerationReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitProfileModerationReport,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["myModerationReports"],
      });

      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });
    },
  });
};