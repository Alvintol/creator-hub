import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ModerationReportResolutionCode,
  ModerationReportStatus,
} from "../../domain/moderation/moderationReports";

type UpdateModerationReportStatusInput = {
  reportId: string;
  status: ModerationReportStatus;
  reporterStatusMessage?: string;
  resolutionCode?: ModerationReportResolutionCode | "";
  adminNotes?: string;
};

const normaliseText = (value?: string) => value?.trim();

export const useUpdateModerationReportStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateModerationReportStatusInput) => {
      const reporterStatusMessage = normaliseText(input.reporterStatusMessage);
      const adminNotes = normaliseText(input.adminNotes);

      if ((reporterStatusMessage ?? "").length > 1000) {
        throw new Error("Reporter status message must be 1000 characters or less.");
      }

      if ((adminNotes ?? "").length > 2000) {
        throw new Error("Admin notes must be 2000 characters or less.");
      }

      const { data, error } = await supabase.rpc(
        "update_moderation_report_status",
        {
          p_report_id: input.reportId,
          p_status: input.status,
          p_reporter_status_message: reporterStatusMessage ?? null,
          p_resolution_code: input.resolutionCode ?? null,
          p_admin_notes: adminNotes ?? null,
        }
      );

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReports"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.reportId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myModerationReports"],
        }),
      ]);
    },
  });
};