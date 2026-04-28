import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

export type ListingRevisionSnapshot = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  offering_type: string;
  fulfilment_mode: "request" | "instant";
  category: string;
  video_subtype: string | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
  status: "draft" | "published";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ListingRevisionRow = {
  id: number;
  listing_id: string;
  actor_user_id: string | null;
  event_type:
  | "created"
  | "updated"
  | "published"
  | "deactivated"
  | "reactivated"
  | "moved_to_draft";
  snapshot: ListingRevisionSnapshot;
  created_at: string;
};

export type ListingRevisionsPage = {
  rows: ListingRevisionRow[];
  hasMore: boolean;
  nextOffset: number | null;
};

type UseListingRevisionsInput = {
  listingId: string | null;
  limit?: number;
  offset?: number;
};

const emptyPage: ListingRevisionsPage = {
  rows: [],
  hasMore: false,
  nextOffset: null,
};

const fetchListingRevisionsPage = async (
  listingId: string,
  limit: number,
  offset: number
): Promise<ListingRevisionsPage> => {
  const { data, error } = await supabase
    .from("listing_revisions")
    .select(`
      id,
      listing_id,
      actor_user_id,
      event_type,
      snapshot,
      created_at
    `)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ListingRevisionRow[];
  const hasMore = rows.length > limit;

  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
};

export const useListingRevisions = (input: UseListingRevisionsInput) => {
  const { listingId, limit = 3, offset = 0 } = input;

  return useQuery<ListingRevisionsPage>({
    queryKey: ["listingRevisions", listingId, limit, offset],
    enabled: Boolean(listingId),
    queryFn: () =>
      listingId
        ? fetchListingRevisionsPage(listingId, limit, offset)
        : Promise.resolve(emptyPage),
    staleTime: 15_000,
  });
};

export const useInfiniteListingRevisions = (
  listingId: string | null,
  limit = 3
) =>
  useInfiniteQuery<ListingRevisionsPage>({
    queryKey: ["listingRevisionsInfinite", listingId, limit],
    enabled: Boolean(listingId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listingId
        ? fetchListingRevisionsPage(listingId, limit, pageParam as number)
        : Promise.resolve(emptyPage),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 15_000,
  });