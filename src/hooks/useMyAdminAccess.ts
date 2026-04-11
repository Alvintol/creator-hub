import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export type AdminRoleKey = "admin";

export type AdminRoleRow = {
  profile_user_id: string;
  role: AdminRoleKey;
  created_at?: string;
  updated_at?: string;
};

// Loads whether the signed-in user has an admin role
const fetchMyAdminAccess = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("admin_roles")
    .select("profile_user_id, role")
    .eq("profile_user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw error;

  return Boolean((data as AdminRoleRow | null)?.profile_user_id);
};

// Returns whether the current signed-in user is an admin
export const useMyAdminAccess = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<boolean>({
    queryKey: ["myAdminAccess", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 30_000,
    queryFn: () => (userId ? fetchMyAdminAccess(userId) : Promise.resolve(false)),
  });
};