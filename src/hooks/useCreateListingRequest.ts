import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import type { ListingRequestSnapshot } from "../lib/listings/listingRequestSnapshot";

export type CreateListingRequestInput = {
  listingId: string;
  creatorUserId: string;
  message: string;
  listingSnapshot: ListingRequestSnapshot;
};

export const useCreateListingRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateListingRequestInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to submit a request.");
      }

      const { data, error } = await supabase
        .from("listing_requests")
        .insert({
          listing_id: input.listingId,
          buyer_user_id: user.id,
          creator_user_id: input.creatorUserId,
          status: "submitted",
          message: input.message.trim(),
          listing_snapshot: input.listingSnapshot,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("The request could not be created.");
      }

      return data.id as string;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myCreatorRequests", user?.id ?? null],
      });
    },
  });
};