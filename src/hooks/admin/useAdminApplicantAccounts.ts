import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ProfilePlatformAccountRow } from "../profile/useProfilePlatformAccounts";

const fetchAdminApplicantPlatformAccounts = async (
  userId: string
): Promise<ProfilePlatformAccountRow[]> => {
  const { data, error } = await supabase
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
    .eq("profile_user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as ProfilePlatformAccountRow[];
};

export const useAdminApplicantPlatformAccounts = (userId: string | null) => {
  return useQuery<ProfilePlatformAccountRow[]>({
    queryKey: ["adminApplicantPlatformAccounts", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: () =>
      userId ? fetchAdminApplicantPlatformAccounts(userId) : Promise.resolve([]),
  });
};