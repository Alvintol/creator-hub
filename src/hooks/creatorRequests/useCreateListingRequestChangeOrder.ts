import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ListingRequestChangeOrderStatus } from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type CreatableListingRequestChangeOrderStatus = Extract<
  ListingRequestChangeOrderStatus,
  "draft" | "sent"
>;

export type CreateListingRequestChangeOrderInput = {
  agreementId: string;
  status: CreatableListingRequestChangeOrderStatus;
  title: string;
  summary: string;
  changesScope: boolean;
  changesPrice: boolean;
  changesTimeline: boolean;
  changesDeliverables: boolean;
  changesPaymentSchedule: boolean;
  changesMilestones: boolean;
  revisedTotalAmount?: number | null;
  revisedCompletionAt?: string | null;
  proposedSnapshot: Record<string, unknown>;
};

export type CreatedListingRequestChangeOrderRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: CreatableListingRequestChangeOrderStatus;
  version_number: number;
  sent_at: string | null;
};

export const useCreateListingRequestChangeOrder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: CreateListingRequestChangeOrderInput
    ): Promise<CreatedListingRequestChangeOrderRow> => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to create a change order."
        );
      }

      const { data, error } = await supabase.rpc(
        "create_listing_request_change_order",
        {
          p_agreement_id: input.agreementId,
          p_status: input.status,
          p_title: input.title.trim(),
          p_summary: input.summary.trim(),
          p_changes_scope: input.changesScope,
          p_changes_price: input.changesPrice,
          p_changes_timeline: input.changesTimeline,
          p_changes_deliverables: input.changesDeliverables,
          p_changes_payment_schedule:
            input.changesPaymentSchedule,
          p_changes_milestones: input.changesMilestones,
          p_revised_total_amount:
            input.changesPrice
              ? input.revisedTotalAmount ?? null
              : null,
          p_revised_completion_at:
            input.changesTimeline
              ? input.revisedCompletionAt ?? null
              : null,
          p_proposed_snapshot: input.proposedSnapshot,
        }
      );

      if (error) {
        throw error;
      }

      const changeOrder = Array.isArray(data)
        ? (data[0] as
            | CreatedListingRequestChangeOrderRow
            | undefined)
        : undefined;

      if (!changeOrder?.id) {
        throw new Error(
          "The project change order could not be created."
        );
      }

      return changeOrder;
    },

    onSuccess: async (changeOrder) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestChangeOrders",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestAgreements",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "creatorRequest",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "buyerRequest",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "adminRequest",
            changeOrder.listing_request_id,
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