import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { MyListingRow } from "../listings/useMyListings";

const fetchAdminListing = async (id: string): Promise<MyListingRow | null> => {
  const { data, error } = await supabase
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
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as MyListingRow | null;
};

export const useAdminListing = (id: string | null) =>
  useQuery<MyListingRow | null>({
    queryKey: ["adminListing", id],
    enabled: Boolean(id),
    queryFn: () => (id ? fetchAdminListing(id) : Promise.resolve(null)),
    staleTime: 15_000,
  });