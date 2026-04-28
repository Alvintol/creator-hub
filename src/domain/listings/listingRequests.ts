export type ListingRequestStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "archived";

export type ListingRequestStatusTone =
  | "review"
  | "success"
  | "danger"
  | "muted";

export const listingRequestStatusOptions: Array<{
  value: ListingRequestStatus;
  label: string;
}> = [
    { value: "submitted", label: "Under review" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "archived", label: "Archived" },
  ];

export const getListingRequestStatusLabel = (
  status: ListingRequestStatus
): string =>
  status === "submitted"
    ? "Under review"
    : status === "accepted"
      ? "Accepted"
      : status === "declined"
        ? "Declined"
        : "Archived";

export const getListingRequestStatusTone = (
  status: ListingRequestStatus
): ListingRequestStatusTone =>
  status === "submitted"
    ? "review"
    : status === "accepted"
      ? "success"
      : status === "declined"
        ? "danger"
        : "muted";

export const getListingRequestStatusSummary = (
  status: ListingRequestStatus
): string =>
  status === "submitted"
    ? "This request is currently under review by the creator."
    : status === "accepted"
      ? "The creator has accepted this request."
      : status === "declined"
        ? "The creator has declined this request."
        : "This request has been archived.";

export const canAcceptListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canDeclineListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canArchiveListingRequest = (
  status: ListingRequestStatus
): boolean => status !== "archived";