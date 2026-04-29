import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type {
  ConversationCloseReasonCode,
  ConversationStatus,
  ConversationType,
} from "../../domain/conversations/conversations";

export type RequestConversationRow = {
  id: string;
  conversation_type: ConversationType;
  buyer_user_id: string;
  creator_user_id: string;
  created_by_user_id: string;
  listing_id: string | null;
  listing_request_id: string | null;
  subject: string | null;
  status: ConversationStatus;
  closed_at: string | null;
  closed_by_user_id: string | null;
  closed_reason_code: ConversationCloseReasonCode | null;
  closed_reason_details: string | null;
  buyer_image_upload_status: "blocked" | "requested" | "approved" | "revoked";
  buyer_image_upload_request_note: string | null;
  last_message_at: string | null;
  last_message_sender_user_id: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

const fetchRequestConversation = async (
  requestId: string
): Promise<RequestConversationRow | null> => {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      conversation_type,
      buyer_user_id,
      creator_user_id,
      created_by_user_id,
      listing_id,
      listing_request_id,
      subject,
      status,
      closed_at,
      closed_by_user_id,
      closed_reason_code,
      closed_reason_details,
      buyer_image_upload_status,
      buyer_image_upload_request_note,
      last_message_at,
      last_message_sender_user_id,
      last_message_preview,
      created_at,
      updated_at
    `)
    .eq("listing_request_id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as RequestConversationRow | null;
};

export const useRequestConversation = (requestId: string | null) =>
  useQuery<RequestConversationRow | null>({
    queryKey: ["requestConversation", requestId],
    enabled: Boolean(requestId),
    queryFn: () =>
      requestId ? fetchRequestConversation(requestId) : Promise.resolve(null),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });