import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ConversationReportResolutionCode,
  ConversationReportStatus,
} from "../../domain/conversations/conversations";

type UpdateConversationReportStatusInput = {
  reportId: string;
  status: ConversationReportStatus;
  reporterStatusMessage?: string;
  resolutionCode?: ConversationReportResolutionCode | "";
  adminNotes?: string;
};

const normaliseNullableText = (value?: string) => value?.trim() ?? "";

export const useUpdateConversationReportStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateConversationReportStatusInput) => {
      const reporterStatusMessage = normaliseNullableText(
        input.reporterStatusMessage
      );
      const adminNotes = normaliseNullableText(input.adminNotes);
      const resolutionCode = input.resolutionCode || null;

      if (reporterStatusMessage.length > 1000) {
        throw new Error("Reporter status message must be 1000 characters or less.");
      }

      if (adminNotes.length > 2000) {
        throw new Error("Admin notes must be 2000 characters or less.");
      }

      const { data, error } = await supabase.rpc(
        "update_conversation_report_status",
        {
          p_report_id: input.reportId,
          p_status: input.status,
          p_reporter_status_message: reporterStatusMessage || null,
          p_resolution_code: resolutionCode,
          p_admin_notes: adminNotes || null,
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
          queryKey: ["adminConversationReports"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminConversationReport", input.reportId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myConversationReports"],
        }),
      ]);
    },
  });
};