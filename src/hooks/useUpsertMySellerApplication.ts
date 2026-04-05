import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import type { SellerApplicationStatus } from "./useMySellerApplication";

type UpsertSellerApplicationInput = {
  status: Extract<SellerApplicationStatus, "draft" | "submitted" | "needs_changes">;
};

// Creates or updates the current user's seller application
const upsertMySellerApplication = async (
  userId: string,
  input: UpsertSellerApplicationInput
) => {
  const now = new Date().toISOString();

  const patch = {
    profile_user_id: userId,
    status: input.status,
    submitted_at: input.status === "submitted" ? now : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("seller_applications")
    .upsert(patch, {
      onConflict: "profile_user_id",
    })
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
};

// Mutation hook for the current user's seller application
export const useUpsertMySellerApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertSellerApplicationInput) => {
      if (!user?.id) throw new Error("You must be signed in.");
      return upsertMySellerApplication(user.id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplication", user?.id],
      });
    },
  });
};