import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export const useMoveListingToDraft = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update this listing.");
      }

      const { data, error } = await supabase
        .from("listings")
        .update({
          status: "draft",
          is_active: false,
        })
        .eq("id", listingId)
        .eq("user_id", user.id)
        .eq("status", "published")
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("Only published listings can be moved back to draft.");
      }

      return data.id;
    },

    onSuccess: async (listingId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myListings", user?.id ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myListing", user?.id ?? null, listingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketListings"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["publicListing", listingId],
        }),
      ]);
    },
  });
};