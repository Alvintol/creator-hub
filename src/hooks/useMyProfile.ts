import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  display_name_auto: boolean;
  bio: string | null;

  profile_setup_seen: boolean;
  auth_provider_last_used: string | null;
};

export const useMyProfile = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ProfileRow | null>({
    queryKey: ["myProfile", userId],
    enabled: !loading && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, handle, display_name, display_name_auto, bio, creator_enabled, twitch_login, twitch_user_id, twitch_created_at, twitch_age_ok, twitch_connected_at"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data as ProfileRow | null) ?? null;
    },
  });
};