import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";
import type {
  BuyerImageUploadStatus,
  ConversationStatus,
} from "../../domain/conversations/conversations";

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

export type CreatorListingRequestConversation = {
  id: string;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  buyer_image_upload_status: BuyerImageUploadStatus;
  updated_at: string;
};

type CreatorListingRequestConversationRow = CreatorListingRequestConversation & {
  listing_requests: ListingRequestRow | ListingRequestRow[] | null;
};

type CreatorListingRequestConversationItem = {
  conversation: CreatorListingRequestConversationRow;
  request: ListingRequestRow;
};


export type CreatorListingRequestItem = {
  request: ListingRequestRow;
  buyer: ListingRequestProfile | null;
  conversation: CreatorListingRequestConversation;
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

const getConversationRequest = (
  conversation: CreatorListingRequestConversationRow
): ListingRequestRow | null =>
  Array.isArray(conversation.listing_requests)
    ? conversation.listing_requests[0] ?? null
    : conversation.listing_requests;

// Loads a paginated creator request inbox from request-linked conversations.
// Conversation.updated_at drives inbox ordering, so new messages/activity move cards up.
const fetchMyCreatorRequests = async (
  userId: string,
  input: UseMyCreatorRequestsInput
): Promise<CreatorListingRequestsResult> => {
  const { archived, page, pageSize = 12 } = input;

  let query = supabase
    .from("conversations")
    .select(
      `
        id,
        status,
        last_message_at,
        last_message_sender_user_id,
        last_message_preview,
        buyer_image_upload_status,
        updated_at,
        listing_requests!inner (
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
        )
      `,
      { count: "exact" }
    )
    .eq("conversation_type", "listing_request")
    .eq("creator_user_id", userId)
    .order("updated_at", { ascending: false });

  query = archived
    ? query.eq("listing_requests.status", "archived")
    : query.neq("listing_requests.status", "archived");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: conversations,
    error: conversationsError,
    count,
  } = await query.range(from, to);

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows =
    (conversations ?? []) as unknown as CreatorListingRequestConversationRow[];

  const conversationItems = conversationRows
    .map((conversation) => ({
      conversation,
      request: getConversationRequest(conversation),
    }))
    .filter(
      (item): item is CreatorListingRequestConversationItem =>
        Boolean(item.request)
    );
  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (conversationItems.length === 0) {
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
    new Set(
      conversationItems.map(
        (item) => item.request.buyer_user_id
      )
    )
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
    items: conversationItems.map((item) => ({
      request: item.request,
      buyer: profileByUserId[item.request.buyer_user_id] ?? null,
      conversation: {
        id: item.conversation.id,
        status: item.conversation.status,
        last_message_at: item.conversation.last_message_at,
        last_message_sender_user_id: item.conversation.last_message_sender_user_id,
        last_message_preview: item.conversation.last_message_preview,
        buyer_image_upload_status: item.conversation.buyer_image_upload_status,
        updated_at: item.conversation.updated_at,
      },
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