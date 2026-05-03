import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ModerationReportReasonCode,
  ModerationReportResolutionCode,
  ModerationReportStatus,
  ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";

export type MyModerationReportRow = {
  id: string;
  target_type: ModerationReportTargetType;
  conversation_id: string | null;
  message_id: string | null;
  listing_id: string | null;
  profile_user_id: string | null;
  reporter_user_id: string;
  reported_user_id: string;
  reason_code: ModerationReportReasonCode;
  reason_details: string | null;
  status: ModerationReportStatus;
  reporter_status_message: string | null;
  reporter_status_updated_at: string | null;
  resolution_code: ModerationReportResolutionCode | null;
  resolved_at: string | null;
  created_at: string;
};

const emptyReports: MyModerationReportRow[] = [];

const fetchMyModerationReports = async (
  conversationId: string,
  userId: string
): Promise<MyModerationReportRow[]> => {
  const { data, error } = await supabase
    .from("moderation_reports")
    .select(`
      id,
      target_type,
      conversation_id,
      message_id,
      listing_id,
      profile_user_id,
      reporter_user_id,
      reported_user_id,
      reason_code,
      reason_details,
      status,
      reporter_status_message,
      reporter_status_updated_at,
      resolution_code,
      resolved_at,
      created_at
    `)
    .eq("conversation_id", conversationId)
    .eq("reporter_user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as MyModerationReportRow[];
};

export const useMyModerationReports = (conversationId: string | null) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<MyModerationReportRow[]>({
    queryKey: ["myModerationReports", conversationId, userId],
    enabled: !loading && Boolean(conversationId && userId),
    queryFn: () =>
      conversationId && userId
        ? fetchMyModerationReports(conversationId, userId)
        : Promise.resolve(emptyReports),
    staleTime: 10_000,
  });
};