import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

export type AdminRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type AdminRequestRow = {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  creator_user_id: string;
  status: ListingRequestStatus;
  message: string;
  creator_status_reason: string | null;
  listing_snapshot: ListingRequestSnapshot;
  created_at: string;
  updated_at: string;
};

export type AdminRequestItem = {
  request: AdminRequestRow;
  buyer: AdminRequestProfile | null;
  creator: AdminRequestProfile | null;
};

export type AdminRequestsFilters = {
  creatorHandle: string;
  buyerHandle: string;
  createdFrom: string;
  createdTo: string;
  status: "all" | ListingRequestStatus;
};

export type AdminRequestsResult = {
  items: AdminRequestItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type UseAdminRequestsInput = {
  filters: AdminRequestsFilters;
  page: number;
  pageSize?: number;
};

const emptyResult: AdminRequestsResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  pageCount: 0,
};

// Normalises a handle search so admins can search with or without @
const normaliseHandle = (value: string) => value.trim().replace(/^@+/, "");

// Converts a YYYY-MM-DD input into the local start-of-day ISO timestamp
const toStartOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Converts a YYYY-MM-DD input into the local end-of-day ISO timestamp
const toEndOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

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

const fetchAdminRequests = async (
  input: UseAdminRequestsInput
): Promise<AdminRequestsResult> => {
  const { filters, page, pageSize = 20 } = input;

  const [creatorUserIds, buyerUserIds] = await Promise.all([
    fetchMatchingProfileIds(filters.creatorHandle),
    fetchMatchingProfileIds(filters.buyerHandle),
  ]);

  if (creatorUserIds && creatorUserIds.length === 0) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      pageCount: 0,
    };
  }

  if (buyerUserIds && buyerUserIds.length === 0) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      pageCount: 0,
    };
  }

  let query = supabase
    .from("listing_requests")
    .select(
      `
        id,
        listing_id,
        buyer_user_id,
        creator_user_id,
        status,
        message,
        creator_status_reason,
        listing_snapshot,
        created_at,
        updated_at
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  const createdFrom = toStartOfDayIso(filters.createdFrom);
  const createdTo = toEndOfDayIso(filters.createdTo);

  if (creatorUserIds) {
    query = query.in("creator_user_id", creatorUserIds);
  }

  if (buyerUserIds) {
    query = query.in("buyer_user_id", buyerUserIds);
  }

  if (createdFrom) {
    query = query.gte("created_at", createdFrom);
  }

  if (createdTo) {
    query = query.lte("created_at", createdTo);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: requests, error: requestsError, count } = await query.range(from, to);

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests ?? []) as AdminRequestRow[];
  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (requestRows.length === 0) {
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
      requestRows.flatMap((request) => [
        request.buyer_user_id,
        request.creator_user_id,
      ])
    )
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminRequestProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminRequestProfile>;

  return {
    items: requestRows.map((request) => ({
      request,
      buyer: profileByUserId[request.buyer_user_id] ?? null,
      creator: profileByUserId[request.creator_user_id] ?? null,
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
  };
};

export const useAdminRequests = (input: UseAdminRequestsInput) =>
  useQuery<AdminRequestsResult>({
    queryKey: ["adminRequests", input],
    queryFn: () => fetchAdminRequests(input),
    staleTime: 15_000,
  });