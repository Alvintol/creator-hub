import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ModerationReportReasonCode,
  ModerationReportResolutionCode,
  ModerationReportStatus,
  ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";
import type {
  AdminModerationReportConversation,
  AdminModerationReportProfile,
} from "./useAdminModerationReports";

export type AdminModerationReportRow = {
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
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  admin_notes: string | null;
  created_at: string;
};

export type AdminModerationReportMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  message_type: "text" | "system" | "attachment" | "mixed";
  body: string | null;
  created_at: string;
};

export type AdminModerationReportListing = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminModerationReportDetails = {
  report: AdminModerationReportRow | null;
  conversation: AdminModerationReportConversation | null;
  messages: AdminModerationReportMessage[];
  listing: AdminModerationReportListing | null;
  reporter: AdminModerationReportProfile | null;
  reportedUser: AdminModerationReportProfile | null;
  profilesByUserId: Record<string, AdminModerationReportProfile>;
  updates: AdminModerationReportUpdate[];
};

export type AdminModerationReportUpdate = {
  id: string;
  report_id: string;
  admin_user_id: string;
  previous_status: ModerationReportStatus;
  new_status: ModerationReportStatus;
  previous_resolution_code: ModerationReportResolutionCode | null;
  new_resolution_code: ModerationReportResolutionCode | null;
  reporter_status_message: string | null;
  admin_notes: string | null;
  created_at: string;
};

const emptyResult: AdminModerationReportDetails = {
  report: null,
  conversation: null,
  messages: [],
  listing: null,
  reporter: null,
  reportedUser: null,
  profilesByUserId: {},
  updates: [],
};

// Loads a single moderation report plus useful target context for admin review
const fetchAdminModerationReport = async (
  reportId: string
): Promise<AdminModerationReportDetails> => {
  const { data: report, error: reportError } = await supabase
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

  const reportRow = report as AdminModerationReportRow;

  const conversationPromise = reportRow.conversation_id
    ? supabase
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
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const messagesPromise = reportRow.conversation_id
    ? supabase
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
      .order("created_at", { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const listingPromise = reportRow.listing_id
    ? supabase
      .from("listings")
      .select(`
          id,
          user_id,
          title,
          status,
          is_active,
          created_at,
          updated_at
        `)
      .eq("id", reportRow.listing_id)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const updatesPromise = supabase
    .from("moderation_report_updates")
    .select(`
    id,
    report_id,
    admin_user_id,
    previous_status,
    new_status,
    previous_resolution_code,
    new_resolution_code,
    reporter_status_message,
    admin_notes,
    created_at
  `)
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  const [
    { data: conversation, error: conversationError },
    { data: messages, error: messagesError },
    { data: listing, error: listingError },
    { data: updates, error: updatesError },
  ] = await Promise.all([
    conversationPromise,
    messagesPromise,
    listingPromise,
    updatesPromise,
  ]);

  if (conversationError) {
    throw conversationError;
  }

  if (messagesError) {
    throw messagesError;
  }

  if (listingError) {
    throw listingError;
  }

  if (updatesError) {
    throw updatesError;
  }

  const messageRows = (messages ?? []) as AdminModerationReportMessage[];
  const updateRows = (updates ?? []) as AdminModerationReportUpdate[];

  const userIds = Array.from(
    new Set(
      [
        reportRow.reporter_user_id,
        reportRow.reported_user_id,
        ...messageRows.map((message) => message.sender_user_id),
        ...updateRows.map((update) => update.admin_user_id),
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
    ((profiles ?? []) as AdminModerationReportProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminModerationReportProfile>;

  return {
    report: reportRow,
    conversation: (conversation ?? null) as AdminModerationReportConversation | null,
    messages: messageRows,
    listing: (listing ?? null) as AdminModerationReportListing | null,
    reporter: profilesByUserId[reportRow.reporter_user_id] ?? null,
    reportedUser: profilesByUserId[reportRow.reported_user_id] ?? null,
    profilesByUserId,
    updates: updateRows,
  };
};

export const useAdminModerationReport = (reportId: string | null) =>
  useQuery<AdminModerationReportDetails>({
    queryKey: ["adminModerationReport", reportId],
    enabled: Boolean(reportId),
    queryFn: () =>
      reportId
        ? fetchAdminModerationReport(reportId)
        : Promise.resolve(emptyResult),
    staleTime: 10_000,
  });