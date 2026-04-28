import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

export type ListingRequestRow = {
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

export type ListingRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CreatorListingRequestItem = {
  request: ListingRequestRow;
  buyer: ListingRequestProfile | null;
};

export type CreatorListingRequestsResult = {
  items: CreatorListingRequestItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  archived: boolean;
};

type UseMyCreatorRequestsInput = {
  archived: boolean;
  page: number;
  pageSize?: number;
};

const emptyResult: CreatorListingRequestsResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 12,
  pageCount: 0,
  archived: false,
};

// Loads a paginated creator request inbox and joins buyer profile display data
const fetchMyCreatorRequests = async (
  userId: string,
  input: UseMyCreatorRequestsInput
): Promise<CreatorListingRequestsResult> => {
  const { archived, page, pageSize = 12 } = input;

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
    .eq("creator_user_id", userId)
    .order("created_at", { ascending: false });

  query = archived
    ? query.eq("status", "archived")
    : query.neq("status", "archived");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: requests, error: requestsError, count } = await query.range(from, to);

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests ?? []) as ListingRequestRow[];
  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (requestRows.length === 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      pageCount,
      archived,
    };
  }

  const buyerIds = Array.from(
    new Set(requestRows.map((request) => request.buyer_user_id))
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", buyerIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as ListingRequestProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, ListingRequestProfile>;

  return {
    items: requestRows.map((request) => ({
      request,
      buyer: profileByUserId[request.buyer_user_id] ?? null,
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
    archived,
  };
};

export const useMyCreatorRequests = (input: UseMyCreatorRequestsInput) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<CreatorListingRequestsResult>({
    queryKey: ["myCreatorRequests", userId, input],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId
        ? fetchMyCreatorRequests(userId, input)
        : Promise.resolve({
          ...emptyResult,
          archived: input.archived,
          page: input.page,
          pageSize: input.pageSize ?? emptyResult.pageSize,
        }),
    staleTime: 15_000,
  });
};