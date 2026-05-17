import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export const useDeleteListingDraft = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!user?.id) {
        throw new Error("You must be signed in to delete a listing.");
      }

      const { data, error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingId)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .eq("is_active", false)
        .is("admin_hidden_at", null)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error(
          "This draft could not be deleted. It may be locked by moderation."
        );
      }

      return data.id as string;
    },

    onSuccess: async (listingId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myListings", user?.id ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myListing", user?.id ?? null, listingId],
        }),
      ]);
    },
  });
};