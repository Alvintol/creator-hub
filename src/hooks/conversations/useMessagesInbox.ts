import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ConversationInitiationReasonCode,
  ConversationStatus,
  ConversationType,
} from "../../domain/conversations/conversations";

export type MessagesInboxViewerRole = "buyer" | "creator";


export type MessagesInboxProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type MessagesInboxListing = {
  id: string;
  title: string;
  preview_url: string | null;
};

export type MessagesInboxConversation = {
  id: string;
  conversation_type: ConversationType;
  buyer_user_id: string;
  creator_user_id: string;
  listing_id: string | null;
  listing_request_id: string | null;
  subject: string | null;
  initiation_reason_code: ConversationInitiationReasonCode | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  updated_at: string;
  created_at: string;
};

export type MessagesInboxItem = {
  conversation: MessagesInboxConversation;
  viewerRole: MessagesInboxViewerRole;
  otherParticipantUserId: string;
  otherParticipant: MessagesInboxProfile | null;
  listing: MessagesInboxListing | null;
  participantLastReadAt: string | null;
  unreadCount: number;
  hasUnread: boolean;
};

export type MessagesInboxResult = {
  items: MessagesInboxItem[];
  totalUnreadCount: number;
};

type UnreadMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  created_at: string;
};

const emptyResult: MessagesInboxResult = {
  items: [],
  totalUnreadCount: 0,
};

// Loads all user-visible communication threads.
// Request conversations are included because Inbox is now the primary nav entry.
const fetchMessagesInbox = async (
  userId: string
): Promise<MessagesInboxResult> => {
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(`
      id,
      conversation_type,
      buyer_user_id,
      creator_user_id,
      listing_id,
      listing_request_id,
      subject,
      initiation_reason_code,
      status,
      last_message_at,
      last_message_sender_user_id,
      last_message_preview,
      updated_at,
      created_at
    `)
    .in("conversation_type", [
      "creator_inquiry",
      "listing_inquiry",
      "listing_request",
    ])
    .or(`buyer_user_id.eq.${userId},creator_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows = (conversations ?? []) as MessagesInboxConversation[];

  if (conversationRows.length === 0) {
    return emptyResult;
  }

  const conversationIds = conversationRows.map((conversation) => conversation.id);

  const otherUserIds = Array.from(
    new Set(
      conversationRows.map((conversation) =>
        conversation.buyer_user_id === userId
          ? conversation.creator_user_id
          : conversation.buyer_user_id
      )
    )
  );

  const listingIds = Array.from(
    new Set(
      conversationRows
        .map((conversation) => conversation.listing_id)
        .filter((listingId): listingId is string => Boolean(listingId))
    )
  );

  const [
    { data: profiles, error: profilesError },
    { data: listings, error: listingsError },
    { data: participants, error: participantsError },
    { data: unreadMessages, error: unreadMessagesError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, handle, display_name, avatar_url")
      .in("user_id", otherUserIds),

    listingIds.length > 0
      ? supabase
        .from("listings")
        .select("id, title, preview_url")
        .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),

    supabase
      .from("conversation_messages")
      .select("id, conversation_id, sender_user_id, created_at")
      .in("conversation_id", conversationIds)
      .neq("sender_user_id", userId),
  ]);

  if (profilesError) {
    throw profilesError;
  }

  if (listingsError) {
    throw listingsError;
  }

  if (participantsError) {
    throw participantsError;
  }

  if (unreadMessagesError) {
    throw unreadMessagesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as MessagesInboxProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, MessagesInboxProfile>;

  const listingById = Object.fromEntries(
    ((listings ?? []) as MessagesInboxListing[]).map((listing) => [
      listing.id,
      listing,
    ])
  ) as Record<string, MessagesInboxListing>;

  const participantByConversationId = Object.fromEntries(
    ((participants ?? []) as Array<{
      conversation_id: string;
      last_read_at: string | null;
    }>).map((participant) => [
      participant.conversation_id,
      participant,
    ])
  );

  // Groups unread candidate messages by conversation to allow efficient lookup when calculating unread counts
  const unreadMessagesByConversationId = (
    (unreadMessages ?? []) as UnreadMessageRow[]
  ).reduce<Record<string, UnreadMessageRow[]>>((acc, message) => {
    const currentMessages = acc[message.conversation_id] ?? [];

    return {
      ...acc,
      [message.conversation_id]: [...currentMessages, message],
    };
  }, {});

  const getUnreadCount = (
    conversationId: string,
    lastReadAt: string | null
  ): number => {
    const messagesForConversation =
      unreadMessagesByConversationId[conversationId] ?? [];

    return messagesForConversation.filter((message) =>
      !lastReadAt ? true : message.created_at > lastReadAt
    ).length;
  };

  const items = conversationRows.map((conversation) => {
    const viewerRole: MessagesInboxViewerRole =
      conversation.buyer_user_id === userId ? "buyer" : "creator";

    const otherParticipantUserId =
      viewerRole === "buyer"
        ? conversation.creator_user_id
        : conversation.buyer_user_id;

    const participant = participantByConversationId[conversation.id] ?? null;
    const participantLastReadAt = participant?.last_read_at ?? null;
    const unreadCount = getUnreadCount(conversation.id, participantLastReadAt);

    return {
      conversation,
      viewerRole,
      otherParticipantUserId,
      otherParticipant: profileByUserId[otherParticipantUserId] ?? null,
      listing: conversation.listing_id
        ? listingById[conversation.listing_id] ?? null
        : null,
      participantLastReadAt,
      unreadCount,
      hasUnread: unreadCount > 0,
    };
  });

  return {
    items,
    totalUnreadCount: items.reduce(
      (total, item) => total + item.unreadCount,
      0
    ),

  };
};

export const useMessagesInbox = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<MessagesInboxResult>({
    queryKey: ["messagesInbox", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId ? fetchMessagesInbox(userId) : Promise.resolve(emptyResult),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
};