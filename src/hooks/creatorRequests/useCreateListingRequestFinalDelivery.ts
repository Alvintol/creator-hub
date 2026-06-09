import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ListingRequestFinalDeliveryStatus,
} from "../../domain/listings/listingRequestFinalDeliveries";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type CreatableListingRequestFinalDeliveryStatus =
  Extract<
    ListingRequestFinalDeliveryStatus,
    "draft" | "submitted"
  >;

export type CreateListingRequestFinalDeliveryInput = {
  agreementId: string;
  status: CreatableListingRequestFinalDeliveryStatus;
  title: string;
  summary: string;
  deliveryLinks: string[];
};

export type CreatedListingRequestFinalDeliveryRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: CreatableListingRequestFinalDeliveryStatus;
  version_number: number;
  submitted_at: string | null;
};

const normalizeDeliveryLinks = (
  deliveryLinks: string[]
): string[] =>
  deliveryLinks
    .map((deliveryLink) => deliveryLink.trim())
    .filter(Boolean);

export const useCreateListingRequestFinalDelivery =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (
        input: CreateListingRequestFinalDeliveryInput
      ): Promise<CreatedListingRequestFinalDeliveryRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to create a final delivery."
          );
        }

        const { data, error } = await supabase.rpc(
          "create_listing_request_final_delivery",
          {
            p_agreement_id: input.agreementId,
            p_status: input.status,
            p_title: input.title.trim(),
            p_summary: input.summary.trim(),
            p_delivery_links: normalizeDeliveryLinks(
              input.deliveryLinks
            ),
          }
        );

        if (error) {
          throw error;
        }

        const finalDelivery = Array.isArray(data)
          ? (data[0] as
              | CreatedListingRequestFinalDeliveryRow
              | undefined)
          : undefined;

        if (!finalDelivery?.id) {
          throw new Error(
            "The final project delivery could not be created."
          );
        }

        return finalDelivery;
      },

      onSuccess: async (finalDelivery) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestFinalDeliveries",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              finalDelivery.listing_request_id,
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