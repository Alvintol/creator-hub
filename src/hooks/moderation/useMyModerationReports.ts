import { useQuery } from "@tanstack/react-query";
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