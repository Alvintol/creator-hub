import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { SellerApplicationStatus } from "./useMySellerApplication";

type ReviewSellerApplicationInput = {
  applicationId: string;
  status: Extract<
    SellerApplicationStatus,
    "under_review" | "approved" | "rejected" | "needs_changes" | "suspended"
  >;
  reviewerNotes?: string;
  rejectionReason?: string;
};

const reviewSellerApplication = async (
  input: ReviewSellerApplicationInput
) => {
  const now = new Date().toISOString();

  const patch = {
    status: input.status,
    reviewer_notes: input.reviewerNotes?.trim() || null,
    rejection_reason: input.rejectionReason?.trim() || null,
    reviewed_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("seller_applications")
    .update(patch)
    .eq("id", input.applicationId)
    .select(`
      id,
      profile_user_id,
      status,
      submitted_at,
      reviewed_at,
      reviewer_notes,
      rejection_reason,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;

  return data;
};

export const useReviewSellerApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewSellerApplicationInput) =>
      reviewSellerApplication(input),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["adminSellerApplications"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["mySellerApplication"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminSellerApplicationSamples", variables.applicationId],
        }),
      ]);
    },
  });
};