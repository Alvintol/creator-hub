import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ModerationReportReasonCode } from "../../domain/moderation/moderationReports";
import { supabase } from "../../lib/supabaseClient";

type SubmitListingModerationReportInput = {
  listingId: string;
  reasonCode: ModerationReportReasonCode;
  reasonDetails?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Listing report could not be submitted.";
};

// Submits a listing report while the RPC derives the reported user safely
const submitListingModerationReport = async (
  input: SubmitListingModerationReportInput
): Promise<string> => {
  const { data, error } = await supabase.rpc(
    "submit_listing_moderation_report",
    {
      p_listing_id: input.listingId,
      p_reason_code: input.reasonCode,
      p_reason_details: input.reasonDetails?.trim() || null,
    }
  );

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data as string;
};

export const useSubmitListingModerationReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitListingModerationReport,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["myModerationReports"],
      });

      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      queryClient.invalidateQueries({
        queryKey: ["adminModerationReportSummary"],
      });
    },
  });
};