import {
  getListingRequestStatusLabel,
  getListingRequestStatusSummary,
  getListingRequestStatusTone,
  type ListingRequestStatus,
} from "../domain//listings/listingRequests";

type ListingRequestStatusCardProps = {
  status: ListingRequestStatus;
  reason?: string | null;
};

const classes = {
  cardBase: "rounded-2xl border px-4 py-4",
  title: "text-sm font-bold",
  text: "mt-1 text-sm",
  reasonBox: "mt-3 rounded-xl border bg-white px-3 py-3",
  reasonLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  reasonText: "mt-1 text-sm text-zinc-800",

  review:
    "border-amber-200 bg-amber-50 text-amber-900",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger:
    "border-red-200 bg-red-50 text-red-900",
  muted:
    "border-zinc-200 bg-zinc-50 text-zinc-900",
} as const;

const getToneClass = (status: ListingRequestStatus): string => {
  const tone = getListingRequestStatusTone(status);

  return tone === "review"
    ? classes.review
    : tone === "success"
      ? classes.success
      : tone === "danger"
        ? classes.danger
        : classes.muted;
};

const ListingRequestStatusCard = (props: ListingRequestStatusCardProps) => {
  const { status, reason } = props;

  return (
    <div className={`${classes.cardBase} ${getToneClass(status)}`}>
      <div className={classes.title}>
        Status: {getListingRequestStatusLabel(status)}
      </div>

      <div className={classes.text}>{getListingRequestStatusSummary(status)}</div>

      {status === "declined" && reason && (
        <div className={classes.reasonBox}>
          <div className={classes.reasonLabel}>Decline reason</div>
          <div className={classes.reasonText}>{reason}</div>
        </div>
      )}
    </div>
  );
};

export default ListingRequestStatusCard;