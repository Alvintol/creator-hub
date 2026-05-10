import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ModerationReportReasonCode,
  ModerationReportResolutionCode,
  ModerationReportStatus,
  ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";
import { supabase } from "../../lib/supabaseClient";

export type MyModerationReport = {
  id: string;
  target_type: ModerationReportTargetType;
  target_label: string;
  reason_code: ModerationReportReasonCode;
  reason_details: string | null;
  status: ModerationReportStatus;
  reporter_status_message: string | null;
  reporter_status_updated_at: string | null;
  reporter_seen_at: string | null;
  has_unread_update: boolean;
  resolution_code: ModerationReportResolutionCode | null;
  resolved_at: string | null;
  created_at: string;
};
// Loads only the current user's own submitted reports
const fetchMyModerationReports = async (): Promise<MyModerationReport[]> => {
  const { data, error } = await supabase.rpc("get_my_moderation_reports");

  if (error) {
    throw error;
  }

  return (data ?? []) as MyModerationReport[];
};

export const useMyModerationReports = () =>
  useQuery({
    queryKey: ["myModerationReports"],
    queryFn: fetchMyModerationReports,
    staleTime: 15_000,
  });

const markMyModerationReportsSeen = async (): Promise<number> => {
  const { data, error } = await supabase.rpc("mark_my_moderation_reports_seen");

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
};

export const useMarkMyModerationReportsSeen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markMyModerationReportsSeen,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["myModerationReports"],
      });
    },
  });
};