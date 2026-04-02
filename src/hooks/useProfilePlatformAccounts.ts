import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export type PlatformKey = "twitch" | "youtube";

export type ProfilePlatformAccountRow = {
  id: string;
  profile_user_id: string;

  platform: PlatformKey;
  platform_user_id: string;

  platform_login: string | null;
  platform_display_name: string | null;
  profile_url: string | null;

  account_created_at: string | null;
  connected_at: string;

  last_activity_at: string | null;
  activity_checked_at: string | null;
  is_active_recently: boolean | null;

  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

// Loads all linked platform accounts for the signed-in user
const fetchProfilePlatformAccounts = async (
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

// Returns the current signed-in user's linked platform accounts
export const useProfilePlatformAccounts = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ProfilePlatformAccountRow[]>({
    queryKey: ["profilePlatformAccounts", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 30_000,
    queryFn: () =>
      userId ? fetchProfilePlatformAccounts(userId) : Promise.resolve([]),
  });
};