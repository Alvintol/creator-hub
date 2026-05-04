import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ConversationInitiationReasonCode,
  ConversationStatus,
  ConversationType,
} from "../../domain/conversations/conversations";

export type ConversationDetailsProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ConversationDetailsListing = {
  id: string;
  title: string;
  preview_url: string | null;
};

export type ConversationDetailsRow = {
  id: string;
  conversation_type: ConversationType;
  buyer_user_id: string;
  creator_user_id: string;
  listing_id: string | null;
  listing_request_id: string | null;
  subject: string | null;
  initiation_reason_code: ConversationInitiationReasonCode | null;
  status: ConversationStatus;
  closed_at: string | null;
  closed_reason_code: string | null;
  closed_reason_details: string | null;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  updated_at: string;
  created_at: string;
  buyer_image_upload_status: "blocked" | "requested" | "approved" | "revoked";
  buyer_image_upload_request_note: string | null;
};

export type ConversationDetailsResult = {
  conversation: ConversationDetailsRow | null;
  buyer: ConversationDetailsProfile | null;
  creator: ConversationDetailsProfile | null;
  listing: ConversationDetailsListing | null;
};

const emptyResult: ConversationDetailsResult = {
  conversation: null,
  buyer: null,
  creator: null,
  listing: null,
};

const fetchConversationDetails = async (
  conversationId: string
): Promise<ConversationDetailsResult> => {
  const { data: conversation, error: conversationError } = await supabase
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
      closed_at,
      closed_reason_code,
      closed_reason_details,
      last_message_at,
      last_message_sender_user_id,
      last_message_preview,
      updated_at,
      created_at,
      buyer_image_upload_status,
      buyer_image_upload_request_note
    `)
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    throw conversationError;
  }

  if (!conversation?.id) {
    return emptyResult;
  }

  const conversationRow = conversation as ConversationDetailsRow;

  const [{ data: profiles, error: profilesError }, { data: listing, error: listingError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, handle, display_name, avatar_url")
        .in("user_id", [
          conversationRow.buyer_user_id,
          conversationRow.creator_user_id,
        ]),
      conversationRow.listing_id
        ? supabase
          .from("listings")
          .select("id, title, preview_url")
          .eq("id", conversationRow.listing_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (profilesError) {
    throw profilesError;
  }

  if (listingError) {
    throw listingError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as ConversationDetailsProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, ConversationDetailsProfile>;

  return {
    conversation: conversationRow,
    buyer: profileByUserId[conversationRow.buyer_user_id] ?? null,
    creator: profileByUserId[conversationRow.creator_user_id] ?? null,
    listing: (listing ?? null) as ConversationDetailsListing | null,
  };
};

export const useConversationDetails = (conversationId: string | null) =>
  useQuery<ConversationDetailsResult>({
    queryKey: ["conversationDetails", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () =>
      conversationId
        ? fetchConversationDetails(conversationId)
        : Promise.resolve(emptyResult),
    staleTime: 10_000,
  });