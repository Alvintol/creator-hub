import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ConversationReportReasonCode,
  ConversationReportResolutionCode,
  ConversationReportStatus,
} from "../../domain/conversations/conversations";
import type {
  AdminConversationReportConversation,
  AdminConversationReportProfile,
  AdminConversationReportRow,
} from "./useAdminConversationReports";

export type AdminConversationReportMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  message_type: "text" | "system" | "attachment" | "mixed";
  body: string | null;
  created_at: string;
};

export type AdminConversationReportDetailsRow = AdminConversationReportRow & {
  reason_code: ConversationReportReasonCode;
  status: ConversationReportStatus;
  resolution_code: ConversationReportResolutionCode | null;
};

export type AdminConversationReportDetails = {
  report: AdminConversationReportDetailsRow | null;
  conversation: AdminConversationReportConversation | null;
  messages: AdminConversationReportMessage[];
  reporter: AdminConversationReportProfile | null;
  reportedUser: AdminConversationReportProfile | null;
  profilesByUserId: Record<string, AdminConversationReportProfile>;
};

const emptyResult: AdminConversationReportDetails = {
  report: null,
  conversation: null,
  messages: [],
  reporter: null,
  reportedUser: null,
  profilesByUserId: {},
};

const fetchAdminConversationReport = async (
  reportId: string
): Promise<AdminConversationReportDetails> => {
  const { data: report, error: reportError } = await supabase
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
      reviewed_at,
      reviewed_by_user_id,
      admin_notes,
      created_at
    `)
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    throw reportError;
  }

  if (!report?.id) {
    return emptyResult;
  }

  const reportRow = report as AdminConversationReportDetailsRow;

  const [{ data: conversation, error: conversationError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select(`
          id,
          conversation_type,
          subject,
          listing_id,
          listing_request_id,
          status,
          last_message_at,
          last_message_preview,
          created_at,
          updated_at
        `)
        .eq("id", reportRow.conversation_id)
        .maybeSingle(),
      supabase
        .from("conversation_messages")
        .select(`
          id,
          conversation_id,
          sender_user_id,
          message_type,
          body,
          created_at
        `)
        .eq("conversation_id", reportRow.conversation_id)
        .order("created_at", { ascending: true }),
    ]);

  if (conversationError) {
    throw conversationError;
  }

  if (messagesError) {
    throw messagesError;
  }

  const messageRows = (messages ?? []) as AdminConversationReportMessage[];

  const userIds = Array.from(
    new Set(
      [
        reportRow.reporter_user_id,
        reportRow.reported_user_id,
        ...messageRows.map((message) => message.sender_user_id),
      ].filter(Boolean)
    )
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profilesByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminConversationReportProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminConversationReportProfile>;

  return {
    report: reportRow,
    conversation: (conversation ?? null) as AdminConversationReportConversation | null,
    messages: messageRows,
    reporter: profilesByUserId[reportRow.reporter_user_id] ?? null,
    reportedUser: profilesByUserId[reportRow.reported_user_id] ?? null,
    profilesByUserId,
  };
};

export const useAdminConversationReport = (reportId: string | null) =>
  useQuery<AdminConversationReportDetails>({
    queryKey: ["adminConversationReport", reportId],
    enabled: Boolean(reportId),
    queryFn: () =>
      reportId ? fetchAdminConversationReport(reportId) : Promise.resolve(emptyResult),
    staleTime: 10_000,
  });