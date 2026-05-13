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

export type AdminModerationReportListing = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminProfileModerationStateSummary = {
  profile_user_id: string;
  is_under_review: boolean;
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
  reporter_seen_at: string | null;
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
  listing: AdminModerationReportListing | null;
  profileModerationState: AdminProfileModerationStateSummary | null;
  reporter: AdminModerationReportProfile | null;
  reportedUser: AdminModerationReportProfile | null;
};

export type AdminModerationReportTriageFilter =
  | "all"
  | "active"
  | "unread_reporter_updates"
  | "profile_under_review"
  | "hidden_listing";

export type AdminModerationReportFilters = {
  reporterHandle: string;
  reportedHandle: string;
  status: "all" | ModerationReportStatus;
  reason: "all" | ModerationReportReasonCode;
  targetType: "all" | ModerationReportTargetType;
  triage: AdminModerationReportTriageFilter;
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

type TriageFilterScope = {
  isEmpty: boolean;
  reportIds?: string[];
  listingIds?: string[];
  profileUserIds?: string[];
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

// Checks whether a reporter-visible update has not been seen by the reporter yet
const hasUnreadReporterUpdate = (row: {
  reporter_status_updated_at: string | null;
  reporter_seen_at: string | null;
}) => {
  if (!row.reporter_status_updated_at) return false;
  if (!row.reporter_seen_at) return true;

  const updatedAt = new Date(row.reporter_status_updated_at);
  const seenAt = new Date(row.reporter_seen_at);

  if (Number.isNaN(updatedAt.getTime())) return false;
  if (Number.isNaN(seenAt.getTime())) return true;

  return updatedAt.getTime() > seenAt.getTime();
};

// Prefetches target ids for triage filters that cannot be expressed cleanly
// with the main paginated moderation_reports query alone
const fetchTriageFilterScope = async (
  triage: AdminModerationReportTriageFilter
): Promise<TriageFilterScope> => {
  if (triage === "all" || triage === "active") {
    return {
      isEmpty: false,
    };
  }

  if (triage === "unread_reporter_updates") {
    const { data, error } = await supabase
      .from("moderation_reports")
      .select("id, reporter_status_updated_at, reporter_seen_at")
      .not("reporter_status_updated_at", "is", null);

    if (error) {
      throw error;
    }

    const reportIds = (data ?? [])
      .filter((row) =>
        hasUnreadReporterUpdate({
          reporter_status_updated_at:
            (row.reporter_status_updated_at as string | null) ?? null,
          reporter_seen_at: (row.reporter_seen_at as string | null) ?? null,
        })
      )
      .map((row) => row.id as string)
      .filter(Boolean);

    return {
      isEmpty: reportIds.length === 0,
      reportIds,
    };
  }

  if (triage === "profile_under_review") {
    const { data, error } = await supabase
      .from("profile_moderation_states")
      .select("profile_user_id")
      .eq("is_under_review", true);

    if (error) {
      throw error;
    }

    const profileUserIds = (data ?? [])
      .map((row) => row.profile_user_id as string)
      .filter(Boolean);

    return {
      isEmpty: profileUserIds.length === 0,
      profileUserIds,
    };
  }

  if (triage === "hidden_listing") {
    const { data, error } = await supabase
      .from("listings")
      .select("id")
      .eq("status", "published")
      .eq("is_active", false);

    if (error) {
      throw error;
    }

    const listingIds = (data ?? [])
      .map((row) => row.id as string)
      .filter(Boolean);

    return {
      isEmpty: listingIds.length === 0,
      listingIds,
    };
  }

  return {
    isEmpty: false,
  };
};

const fetchAdminModerationReports = async (
  input: UseAdminModerationReportsInput
): Promise<AdminModerationReportsResult> => {
  const { filters, page, pageSize = 20 } = input;

  const [reporterUserIds, reportedUserIds, triageScope] = await Promise.all([
    fetchMatchingProfileIds(filters.reporterHandle),
    fetchMatchingProfileIds(filters.reportedHandle),
    fetchTriageFilterScope(filters.triage),
  ]);

  if (reporterUserIds && reporterUserIds.length === 0) {
    return { ...emptyResult, page, pageSize };
  }

  if (reportedUserIds && reportedUserIds.length === 0) {
    return { ...emptyResult, page, pageSize };
  }

  if (triageScope.isEmpty) {
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
        reporter_seen_at,
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

  if (filters.triage === "active") {
    query = query.is("resolved_at", null);
  }

  if (triageScope.reportIds) {
    query = query.in("id", triageScope.reportIds);
  }

  if (triageScope.profileUserIds) {
    query = query
      .eq("target_type", "profile")
      .in("profile_user_id", triageScope.profileUserIds);
  }

  if (triageScope.listingIds) {
    query = query
      .eq("target_type", "listing")
      .in("listing_id", triageScope.listingIds);
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

  const listingIds = Array.from(
    new Set(
      reportRows
        .map((report) => report.listing_id)
        .filter((listingId): listingId is string => Boolean(listingId))
    )
  );

  const profileUserIds = Array.from(
    new Set(
      reportRows
        .map((report) => report.profile_user_id)
        .filter((profileUserId): profileUserId is string => Boolean(profileUserId))
    )
  );

  const [
    { data: profiles, error: profilesError },
    { data: conversations, error: conversationsError },
    { data: listings, error: listingsError },
    {
      data: profileModerationStates,
      error: profileModerationStatesError,
    },
  ] = await Promise.all([
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
    listingIds.length > 0
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
        .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
    profileUserIds.length > 0
      ? supabase
        .from("profile_moderation_states")
        .select(`
          profile_user_id,
          is_under_review,
          updated_at
        `)
        .in("profile_user_id", profileUserIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesError) {
    throw profilesError;
  }

  if (conversationsError) {
    throw conversationsError;
  }

  if (listingsError) {
    throw listingsError;
  }

  if (profileModerationStatesError) {
    throw profileModerationStatesError;
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

  const listingById = Object.fromEntries(
    ((listings ?? []) as AdminModerationReportListing[]).map((listing) => [
      listing.id,
      listing,
    ])
  ) as Record<string, AdminModerationReportListing>;

  const profileModerationStateByUserId = Object.fromEntries(
    ((profileModerationStates ?? []) as AdminProfileModerationStateSummary[]).map(
      (state) => [state.profile_user_id, state]
    )
  ) as Record<string, AdminProfileModerationStateSummary>;

  return {
    items: reportRows.map((report) => ({
      report,
      conversation: report.conversation_id
        ? conversationById[report.conversation_id] ?? null
        : null,
      listing: report.listing_id ? listingById[report.listing_id] ?? null : null,
      profileModerationState: report.profile_user_id
        ? profileModerationStateByUserId[report.profile_user_id] ?? null
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