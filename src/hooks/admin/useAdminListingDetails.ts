import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { MyListingRow } from "../listings/useMyListings";
import type { AdminListingCreator } from "./useAdminListings";

export type AdminListingDetails = {
  listing: MyListingRow | null;
  creator: AdminListingCreator | null;
};

const emptyResult: AdminListingDetails = {
  listing: null,
  creator: null,
};

const fetchAdminListingDetails = async (
  id: string
): Promise<AdminListingDetails> => {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(`
      id,
      user_id,
      title,
      short,
      offering_type,
      category,
      video_subtype,
      price_type,
      price_min,
      price_max,
      deliverables,
      tags,
      preview_url,
      status,
      is_active,
      created_at,
      updated_at,
      fulfilment_mode
    `)
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw listingError;
  }

  if (!listing?.user_id) {
    return emptyResult;
  }

  const { data: creator, error: creatorError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .eq("user_id", listing.user_id)
    .maybeSingle();

  if (creatorError) {
    throw creatorError;
  }

  return {
    listing: listing as MyListingRow,
    creator: (creator ?? null) as AdminListingCreator | null,
  };
};

export const useAdminListingDetails = (id: string | null) =>
  useQuery<AdminListingDetails>({
    queryKey: ["adminListingDetails", id],
    enabled: Boolean(id),
    queryFn: () => (id ? fetchAdminListingDetails(id) : Promise.resolve(emptyResult)),
    staleTime: 15_000,
  });