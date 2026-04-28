export type ListingRequestStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "archived";

export const listingRequestStatusOptions: Array<{
  value: ListingRequestStatus;
  label: string;
}> = [
    { value: "submitted", label: "Submitted" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "archived", label: "Archived" },
  ];

export const getListingRequestStatusLabel = (
  status: ListingRequestStatus
): string =>
  status === "submitted"
    ? "Submitted"
    : status === "accepted"
      ? "Accepted"
      : status === "declined"
        ? "Declined"
        : "Archived";

export const canAcceptListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canDeclineListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canArchiveListingRequest = (
  status: ListingRequestStatus
): boolean => status !== "archived";