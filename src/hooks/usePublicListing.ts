import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { ProfilePlatformAccountRow } from "./useProfilePlatformAccounts";

  export type PublicListingRow = {
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
    status: string;
    is_active: boolean;
    updated_at: string;
  };

export type PublicListingCreator = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type PublicListingPageData = {
  listing: PublicListingRow | null;
  creator: PublicListingCreator | null;
  platformAccounts: ProfilePlatformAccountRow[];
};

const emptyResult: PublicListingPageData = {
  listing: null,
  creator: null,
  platformAccounts: [],
};

const fetchPublicListing = async (
  id: string
): Promise<PublicListingPageData> => {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(`
      id,
      user_id,
      title,
      short,
      offering_type,
      fulfilment_mode,
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
      updated_at
    `)
    .eq("id", id)
    .eq("status", "published")
    .eq("is_active", true)
    .maybeSingle();

  if (listingError) throw listingError;
  if (!listing?.user_id) return emptyResult;

  const { data: creator, error: creatorError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .eq("user_id", listing.user_id)
    .maybeSingle();

  if (creatorError) throw creatorError;

  const { data: platformAccounts, error: platformError } = await supabase
    .from("profile_platform_accounts")
    .select(`
      id,
      profile_user_id,
      platform,
      platform_user_id,
      platform_login,
      platform_display_name,
      profile_url,
      account_created_at,
      connected_at,
      last_activity_at,
      activity_checked_at,
      is_active_recently,
      metadata,
      created_at,
      updated_at
    `)
    .eq("profile_user_id", listing.user_id)
    .order("connected_at", { ascending: false });

  if (platformError) throw platformError;

  return {
    listing: listing as PublicListingRow,
    creator: (creator ?? null) as PublicListingCreator | null,
    platformAccounts: (platformAccounts ?? []) as ProfilePlatformAccountRow[],
  };
};

export const usePublicListing = (id: string | null) =>
  useQuery<PublicListingPageData>({
    queryKey: ["publicListing", id],
    enabled: Boolean(id),
    queryFn: () => (id ? fetchPublicListing(id) : Promise.resolve(emptyResult)),
  });