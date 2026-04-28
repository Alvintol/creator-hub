import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type SetListingActiveStateInput = {
  listingId: string;
  isActive: boolean;
};

export const useSetListingActiveState = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SetListingActiveStateInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update listing visibility.");
      }

      const { listingId, isActive } = input;

      const { data, error } = await supabase
        .from("listings")
        .update({
          is_active: isActive,
        })
        .eq("id", listingId)
        .eq("user_id", user.id)
        .eq("status", "published")
        .select("id, is_active")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("Only published listings can change visibility right now.");
      }

      return data;
    },

    onSuccess: async (data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myListings", user?.id ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myListing", user?.id ?? null, variables.listingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketListings"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["publicListing", variables.listingId],
        }),
      ]);
    },
  });
};