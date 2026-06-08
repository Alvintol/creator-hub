import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestProgressUpdateKind =
  | "progress"
  | "milestone"
  | "delay"
  | "final_preview";

export type CreateListingRequestProgressUpdateInput = {
  agreementId: string;
  updateKind: ListingRequestProgressUpdateKind;
  title: string;
  body: string;
  progressPercent?: number | null;
};

export type CreatedListingRequestProgressUpdateRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  update_kind: ListingRequestProgressUpdateKind;
  title: string;
  body: string;
  progress_percent: number | null;
  created_at: string;
};

export const useCreateListingRequestProgressUpdate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: CreateListingRequestProgressUpdateInput
    ): Promise<CreatedListingRequestProgressUpdateRow> => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to post a progress update."
        );
      }

      const { data, error } = await supabase.rpc(
        "create_listing_request_progress_update",
        {
          p_agreement_id: input.agreementId,
          p_update_kind: input.updateKind,
          p_title: input.title.trim(),
          p_body: input.body.trim(),
          p_progress_percent: input.progressPercent ?? null,
        }
      );

      if (error) {
        throw error;
      }

      const progressUpdate = Array.isArray(data)
        ? (data[0] as
            | CreatedListingRequestProgressUpdateRow
            | undefined)
        : undefined;

      if (!progressUpdate?.id) {
        throw new Error(
          "The project progress update could not be created."
        );
      }

      return progressUpdate;
    },

    onSuccess: async (progressUpdate) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestProgressUpdates",
            progressUpdate.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestAgreements",
            progressUpdate.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "creatorRequest",
            progressUpdate.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "buyerRequest",
            progressUpdate.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "adminRequest",
            progressUpdate.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
      ]);
    },
  });
};