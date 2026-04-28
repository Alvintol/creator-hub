import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

export type AdminListingMetrics = {
  totalListings: number;
  publishedListings: number;
  draftListings: number;
  activeListings: number;
  inactiveListings: number;
  totalRevisions: number;
};

const emptyMetrics: AdminListingMetrics = {
  totalListings: 0,
  publishedListings: 0,
  draftListings: 0,
  activeListings: 0,
  inactiveListings: 0,
  totalRevisions: 0,
};

// Loads high-level admin listing metrics for the dashboard
const fetchAdminListingMetrics = async (): Promise<AdminListingMetrics> => {
  const [
    { count: totalListings, error: totalListingsError },
    { count: publishedListings, error: publishedListingsError },
    { count: draftListings, error: draftListingsError },
    { count: activeListings, error: activeListingsError },
    { count: inactiveListings, error: inactiveListingsError },
    { count: totalRevisions, error: totalRevisionsError },
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }),

    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),

    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),

    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),

    supabase
      .from("listing_revisions")
      .select("id", { count: "exact", head: true }),
  ]);

  if (totalListingsError) throw totalListingsError;
  if (publishedListingsError) throw publishedListingsError;
  if (draftListingsError) throw draftListingsError;
  if (activeListingsError) throw activeListingsError;
  if (inactiveListingsError) throw inactiveListingsError;
  if (totalRevisionsError) throw totalRevisionsError;

  return {
    totalListings: totalListings ?? 0,
    publishedListings: publishedListings ?? 0,
    draftListings: draftListings ?? 0,
    activeListings: activeListings ?? 0,
    inactiveListings: inactiveListings ?? 0,
    totalRevisions: totalRevisions ?? 0,
  };
};

export const useAdminListingMetrics = () =>
  useQuery<AdminListingMetrics>({
    queryKey: ["adminListingMetrics"],
    queryFn: fetchAdminListingMetrics,
    staleTime: 15_000,
    placeholderData: emptyMetrics,
  });