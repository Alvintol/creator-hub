import {
  getListingRequestStatusSummary,
  type ListingRequestArchiveContext,
  type ListingRequestStatus,
} from "../../../domain/listings/listingRequests";

type RequestStatusNoticeProps = {
  status: ListingRequestStatus;
  reason?: string | null;
  archiveContext?: ListingRequestArchiveContext;
};

// Closed requests explain why in the header; open ones rely on the next-step card instead.
const RequestStatusNotice = ({ status, reason, archiveContext }: RequestStatusNoticeProps) => {
  if (status !== "declined" && status !== "archived") return null;

  return (
    <div className={status === "declined" ? "notice noticeError" : "notice noticeNeutral"}>
      <p>{getListingRequestStatusSummary(status, archiveContext)}</p>
      {status === "declined" && reason && (
        <p className="mt-1">
          <span className="font-semibold">Decline reason: </span>
          {reason}
        </p>
      )}
    </div>
  );
};

export default RequestStatusNotice;
