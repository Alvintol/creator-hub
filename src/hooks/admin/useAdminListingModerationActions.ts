import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type AdminListingModerationInput = {
  listingId: string;
  moderationReportId?: string | null;
  adminNote?: string | null;
};

type AdminListingModerationResult = {
  listing_id: string;
  previous_status: string;
  new_status: string;
  previous_is_active: boolean;
  new_is_active: boolean;
  changed: boolean;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Listing moderation action failed.";
};

// Runs one of the admin-only listing moderation RPCs
const runListingModerationRpc = async (
  rpcName: "admin_hide_listing" | "admin_restore_listing",
  input: AdminListingModerationInput
): Promise<AdminListingModerationResult> => {
  const { data, error } = await supabase.rpc(rpcName, {
    p_listing_id: input.listingId,
    p_moderation_report_id: input.moderationReportId ?? null,
    p_admin_note: input.adminNote ?? null,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data as AdminListingModerationResult;
};

export const useAdminHideListing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminListingModerationInput) =>
      runListingModerationRpc("admin_hide_listing", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};

export const useAdminRestoreListing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminListingModerationInput) =>
      runListingModerationRpc("admin_restore_listing", input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["adminModerationReports"],
      });

      if (input.moderationReportId) {
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReport", input.moderationReportId],
        });
      }
    },
  });
};