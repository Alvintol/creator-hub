import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export type AuthProviderKey = "email" | "google" | "twitch";
export type ProfileVisibility = "private" | "public";

export type ProfileRow = {
  // Core account identity
  user_id: string;
  handle: string | null;
  display_name: string | null;
  display_name_auto: boolean;
  bio: string | null;

  // Public profile presentation
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;

  // Optional account context
  country_code: string | null;
  timezone: string | null;

  // Visibility / communication
  profile_visibility: ProfileVisibility;
  messaging_enabled: boolean;

  // Onboarding / setup
  profile_setup_seen: boolean;
  profile_setup_completed_at: string | null;
  onboarding_version: number;

  // Auth context
  auth_provider_last_used: AuthProviderKey | null;

  // Timestamps
  created_at: string;
  updated_at: string;
};

// Loads the signed-in user's profile row
const fetchMyProfile = async (userId: string): Promise<ProfileRow | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      user_id,
      handle,
      display_name,
      display_name_auto,
      bio,
      avatar_url,
      banner_url,
      website_url,
      country_code,
      timezone,
      profile_visibility,
      messaging_enabled,
      profile_setup_seen,
      profile_setup_completed_at,
      onboarding_version,
      auth_provider_last_used,
      created_at,
      updated_at
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  console.log({ profileData: data })
  return (data as ProfileRow | null) ?? null;
};

// Returns the current signed-in user's profile
export const useMyProfile = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ProfileRow | null>({
    queryKey: ["myProfile", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 30_000,
    queryFn: () => (userId ? fetchMyProfile(userId) : Promise.resolve(null)),
  });
};