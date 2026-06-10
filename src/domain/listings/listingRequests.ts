export type ListingRequestStatus =
  | "submitted"
  | "accepted"
  | "completed"
  | "declined"
  | "archived";

export type ListingRequestListView =
  | "active"
  | "completed"
  | "archived";

export type ListingRequestStatusTone =
  | "review"
  | "success"
  | "danger"
  | "muted";

export type ListingRequestArchiveContext = {
  buyer_user_id?: string | null;
  creator_user_id?: string | null;
  archived_by_user_id?: string | null;
};

export const listingRequestStatusOptions: Array<{
  value: ListingRequestStatus;
  label: string;
}> = [
    {
      value: "submitted",
      label: "Under review",
    },
    {
      value: "accepted",
      label: "Accepted",
    },
    {
      value: "completed",
      label: "Completed",
    },
    {
      value: "declined",
      label: "Declined",
    },
    {
      value: "archived",
      label: "Archived",
    },
  ];

export const getListingRequestStatusesForView = (
  view: ListingRequestListView
): ListingRequestStatus[] =>
  view === "active"
    ? ["submitted", "accepted"]
    : view === "completed"
      ? ["completed"]
      : ["declined", "archived"];

export const getListingRequestStatusLabel = (
  status: ListingRequestStatus,
  archiveContext?: ListingRequestArchiveContext
): string =>
  status === "submitted"
    ? "Under review"
    : status === "accepted"
      ? "Accepted"
      : status === "completed"
        ? "Completed"
        : status === "declined"
          ? "Declined"
          : archiveContext?.archived_by_user_id &&
            archiveContext.buyer_user_id &&
            archiveContext.archived_by_user_id ===
            archiveContext.buyer_user_id
            ? "Cancelled by buyer"
            : archiveContext?.archived_by_user_id &&
              archiveContext.creator_user_id &&
              archiveContext.archived_by_user_id ===
              archiveContext.creator_user_id
              ? "Archived by creator"
              : "Archived";

export const getListingRequestStatusTone = (
  status: ListingRequestStatus
): ListingRequestStatusTone =>
  status === "submitted"
    ? "review"
    : status === "accepted" ||
      status === "completed"
      ? "success"
      : status === "declined"
        ? "danger"
        : "muted";

export const getListingRequestStatusSummary = (
  status: ListingRequestStatus,
  archiveContext?: ListingRequestArchiveContext
): string =>
  status === "submitted"
    ? "This request is currently under review by the creator."
    : status === "accepted"
      ? "The creator has accepted this request."
      : status === "completed"
        ? "The buyer approved the final delivery and the project is complete."
        : status === "declined"
          ? "The creator has declined this request."
          : archiveContext?.archived_by_user_id &&
            archiveContext.buyer_user_id &&
            archiveContext.archived_by_user_id ===
            archiveContext.buyer_user_id
            ? "The buyer cancelled this request."
            : archiveContext?.archived_by_user_id &&
              archiveContext.creator_user_id &&
              archiveContext.archived_by_user_id ===
              archiveContext.creator_user_id
              ? "The creator archived this request."
              : "This request has been archived.";

export const canAcceptListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canDeclineListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canArchiveListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";