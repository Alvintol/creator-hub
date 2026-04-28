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

      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingId)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .eq("is_active", false);

      if (error) {
        throw error;
      }

      return listingId;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myListings", user?.id ?? null],
      });
    },
  });
};