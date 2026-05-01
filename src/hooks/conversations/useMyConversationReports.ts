import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ConversationReportReasonCode,
  ConversationReportResolutionCode,
  ConversationReportStatus,
} from "../../domain/conversations/conversations";

export type MyConversationReportRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  reporter_user_id: string;
  reported_user_id: string;
  reason_code: ConversationReportReasonCode;
  reason_details: string | null;
  status: ConversationReportStatus;
  reporter_status_message: string | null;
  reporter_status_updated_at: string | null;
  resolution_code: ConversationReportResolutionCode | null;
  resolved_at: string | null;
  created_at: string;
};

const emptyReports: MyConversationReportRow[] = [];

// Loads only the current user's reports for this conversation
const fetchMyConversationReports = async (
  conversationId: string,
  userId: string
): Promise<MyConversationReportRow[]> => {
  const { data, error } = await supabase
    .from("conversation_reports")
    .select(`
      id,
      conversation_id,
      message_id,
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

  return (data ?? []) as MyConversationReportRow[];
};

export const useMyConversationReports = (conversationId: string | null) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<MyConversationReportRow[]>({
    queryKey: ["myConversationReports", conversationId, userId],
    enabled: !loading && Boolean(conversationId && userId),
    queryFn: () =>
      conversationId && userId
        ? fetchMyConversationReports(conversationId, userId)
        : Promise.resolve(emptyReports),
    staleTime: 10_000,
  });
};