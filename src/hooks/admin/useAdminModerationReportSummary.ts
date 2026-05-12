import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

export type AdminModerationReportSummary = {
  submitted_count: number;
  active_count: number;
  resolved_count: number;
  unread_reporter_update_count: number;
  profile_under_review_count: number;
  hidden_listing_count: number;
};

export const emptyAdminModerationReportSummary: AdminModerationReportSummary = {
  submitted_count: 0,
  active_count: 0,
  resolved_count: 0,
  unread_reporter_update_count: 0,
  profile_under_review_count: 0,
  hidden_listing_count: 0,
};

// Loads global moderation summary counts for admin triage cards
const fetchAdminModerationReportSummary =
  async (): Promise<AdminModerationReportSummary> => {
    const { data, error } = await supabase.rpc(
      "get_admin_moderation_report_summary"
    );

    if (error) {
      throw error;
    }

    const firstRow = Array.isArray(data) ? data[0] : data;

    return {
      submitted_count: Number(firstRow?.submitted_count ?? 0),
      active_count: Number(firstRow?.active_count ?? 0),
      resolved_count: Number(firstRow?.resolved_count ?? 0),
      unread_reporter_update_count: Number(
        firstRow?.unread_reporter_update_count ?? 0
      ),
      profile_under_review_count: Number(
        firstRow?.profile_under_review_count ?? 0
      ),
      hidden_listing_count: Number(firstRow?.hidden_listing_count ?? 0),
    };
  };

export const useAdminModerationReportSummary = () =>
  useQuery({
    queryKey: ["adminModerationReportSummary"],
    queryFn: fetchAdminModerationReportSummary,
    staleTime: 15_000,
  });