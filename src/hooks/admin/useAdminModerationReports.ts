import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ModerationReportReasonCode,
  ModerationReportResolutionCode,
  ModerationReportStatus,
  ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";

export type AdminModerationReportProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type AdminModerationReportConversation = {
  id: string;
  conversation_type: string;
  subject: string | null;
  listing_id: string | null;
  listing_request_id: string | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

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

export type AdminModerationReportItem = {
  report: AdminModerationReportRow;
  conversation: AdminModerationReportConversation | null;
  reporter: AdminModerationReportProfile | null;
  reportedUser: AdminModerationReportProfile | null;
};

export type AdminModerationReportFilters = {
  reporterHandle: string;
  reportedHandle: string;
  status: "all" | ModerationReportStatus;
  reason: "all" | ModerationReportReasonCode;
  targetType: "all" | ModerationReportTargetType;
};

export type AdminModerationReportsResult = {
  items: AdminModerationReportItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type UseAdminModerationReportsInput = {
  filters: AdminModerationReportFilters;
  page: number;
  pageSize?: number;
};

const emptyResult: AdminModerationReportsResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  pageCount: 0,
};

// Allows admins to search handles with or without @
const normaliseHandle = (value: string) => value.trim().replace(/^@+/, "");

const fetchMatchingProfileIds = async (
  fieldValue: string
): Promise<string[] | null> => {
  const handle = normaliseHandle(fieldValue);
  if (!handle) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("handle", `%${handle}%`);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((profile) => profile.user_id as string)
    .filter(Boolean);
};

const fetchAdminModerationReports = async (
  input: UseAdminModerationReportsInput
): Promise<AdminModerationReportsResult> => {
  const { filters, page, pageSize = 20 } = input;

  const [reporterUserIds, reportedUserIds] = await Promise.all([
    fetchMatchingProfileIds(filters.reporterHandle),
    fetchMatchingProfileIds(filters.reportedHandle),
  ]);

  if (reporterUserIds && reporterUserIds.length === 0) {
    return { ...emptyResult, page, pageSize };
  }

  if (reportedUserIds && reportedUserIds.length === 0) {
    return { ...emptyResult, page, pageSize };
  }

  let query = supabase
    .from("moderation_reports")
    .select(
      `
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
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (reporterUserIds) {
    query = query.in("reporter_user_id", reporterUserIds);
  }

  if (reportedUserIds) {
    query = query.in("reported_user_id", reportedUserIds);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.reason !== "all") {
    query = query.eq("reason_code", filters.reason);
  }

  if (filters.targetType !== "all") {
    query = query.eq("target_type", filters.targetType);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: reports, error: reportsError, count } = await query.range(from, to);

  if (reportsError) {
    throw reportsError;
  }

  const reportRows = (reports ?? []) as AdminModerationReportRow[];
  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (reportRows.length === 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      pageCount,
    };
  }

  const userIds = Array.from(
    new Set(
      reportRows.flatMap((report) => [
        report.reporter_user_id,
        report.reported_user_id,
      ])
    )
  );

  const conversationIds = Array.from(
    new Set(
      reportRows
        .map((report) => report.conversation_id)
        .filter((conversationId): conversationId is string => Boolean(conversationId))
    )
  );

  const [{ data: profiles, error: profilesError }, { data: conversations, error: conversationsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url")
        .in("user_id", userIds),
      conversationIds.length > 0
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
            .in("id", conversationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesError) {
    throw profilesError;
  }

  if (conversationsError) {
    throw conversationsError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminModerationReportProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminModerationReportProfile>;

  const conversationById = Object.fromEntries(
    ((conversations ?? []) as AdminModerationReportConversation[]).map(
      (conversation) => [conversation.id, conversation]
    )
  ) as Record<string, AdminModerationReportConversation>;

  return {
    items: reportRows.map((report) => ({
      report,
      conversation: report.conversation_id
        ? conversationById[report.conversation_id] ?? null
        : null,
      reporter: profileByUserId[report.reporter_user_id] ?? null,
      reportedUser: profileByUserId[report.reported_user_id] ?? null,
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
  };
};

export const useAdminModerationReports = (
  input: UseAdminModerationReportsInput
) =>
  useQuery<AdminModerationReportsResult>({
    queryKey: ["adminModerationReports", input],
    queryFn: () => fetchAdminModerationReports(input),
    staleTime: 15_000,
  });