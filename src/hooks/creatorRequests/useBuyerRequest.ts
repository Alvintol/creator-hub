import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  BuyerListingRequestProfile,
  BuyerListingRequestRow,
} from "./useMyBuyerRequests";

export type BuyerRequestDetails = {
  request: BuyerListingRequestRow | null;
  creator: BuyerListingRequestProfile | null;
};

const emptyResult: BuyerRequestDetails = {
  request: null,
  creator: null,
};

// Loads a single buyer-owned request and joins creator profile data
const fetchBuyerRequest = async (
  userId: string,
  requestId: string
): Promise<BuyerRequestDetails> => {
  const { data: request, error: requestError } = await supabase
    .from("listing_requests")
    .select(`
      id,
      listing_id,
      buyer_user_id,
      creator_user_id,
      status,
      message,
      listing_snapshot,
      created_at,
      updated_at
    `)
    .eq("id", requestId)
    .eq("buyer_user_id", userId)
    .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  if (!request?.creator_user_id) {
    return emptyResult;
  }

  const { data: creator, error: creatorError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .eq("user_id", request.creator_user_id)
    .maybeSingle();

  if (creatorError) {
    throw creatorError;
  }

  return {
    request: request as BuyerListingRequestRow,
    creator: (creator ?? null) as BuyerListingRequestProfile | null,
  };
};

export const useBuyerRequest = (requestId: string | null) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<BuyerRequestDetails>({
    queryKey: ["buyerRequest", userId, requestId],
    enabled: !loading && Boolean(userId && requestId),
    queryFn: () =>
      userId && requestId
        ? fetchBuyerRequest(userId, requestId)
        : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });
};