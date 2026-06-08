import {
  getListingRequestProgressUpdateSchedule,
  type ListingRequestProgressUpdateScheduleStatus,
} from "../domain/listings/listingRequestProgressUpdates";
import type { ListingRequestAgreementRow } from "../hooks/creatorRequests/useListingRequestAgreement";
import type { ListingRequestProgressUpdateRow } from "../hooks/creatorRequests/useListingRequestProgressUpdates";

type ScheduleAgreement = Pick<
  ListingRequestAgreementRow,
  | "status"
  | "starting_payment_status"
  | "minimum_update_rule"
  | "first_update_due_days"
  | "update_frequency_days"
  | "estimated_start_at"
  | "adjusted_estimated_completion_at"
>;

type ScheduleUpdate = Pick<
  ListingRequestProgressUpdateRow,
  "created_at"
>;

type ListingRequestProgressUpdateScheduleCardProps = {
  agreement: ScheduleAgreement | null;
  updates: ScheduleUpdate[];
  now?: Date;
};

const classes = {
  card: "rounded-2xl border px-4 py-4",
  notStartedCard:
    "border-zinc-200 bg-zinc-50 text-zinc-900",
  upcomingCard:
    "border-blue-200 bg-blue-50 text-blue-950",
  dueSoonCard:
    "border-amber-200 bg-amber-50 text-amber-950",
  overdueCard:
    "border-red-200 bg-red-50 text-red-950",
  satisfiedCard:
    "border-emerald-200 bg-emerald-50 text-emerald-950",
  header:
    "flex flex-wrap items-start justify-between gap-3",
  heading: "space-y-1",
  title: "text-sm font-extrabold",
  text: "text-sm opacity-90",
  badge:
    "inline-flex rounded-full border border-current px-3 py-1 text-xs font-bold",
  metaGrid: "mt-4 grid gap-3 sm:grid-cols-3",
  metaBlock: "space-y-1",
  metaLabel:
    "text-xs font-bold uppercase tracking-wide opacity-70",
  metaValue: "text-sm font-semibold",
} as const;

const statusLabels: Record<
  ListingRequestProgressUpdateScheduleStatus,
  string
> = {
  not_started: "Update schedule not started",
  upcoming: "Update scheduled",
  due_soon: "Update due soon",
  overdue: "Update overdue",
  satisfied: "Update requirement satisfied",
};

const statusClasses: Record<
  ListingRequestProgressUpdateScheduleStatus,
  string
> = {
  not_started: classes.notStartedCard,
  upcoming: classes.upcomingCard,
  due_soon: classes.dueSoonCard,
  overdue: classes.overdueCard,
  satisfied: classes.satisfiedCard,
};

const badgeLabels: Record<
  ListingRequestProgressUpdateScheduleStatus,
  string
> = {
  not_started: "Not started",
  upcoming: "Upcoming",
  due_soon: "Due soon",
  overdue: "Overdue",
  satisfied: "Satisfied",
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const ListingRequestProgressUpdateScheduleCard = ({
  agreement,
  updates,
  now,
}: ListingRequestProgressUpdateScheduleCardProps) => {
  if (!agreement || agreement.status !== "buyer_accepted") {
    return null;
  }

  const schedule =
    getListingRequestProgressUpdateSchedule({
      agreement,
      updates,
      now,
    });

  const nextUpdateText = schedule.nextUpdateDueAt
    ? formatDateTime(schedule.nextUpdateDueAt)
    : schedule.status === "satisfied"
      ? "Requirement completed"
      : "Not scheduled";

  const lastUpdateText = schedule.lastUpdateAt
    ? formatDateTime(schedule.lastUpdateAt)
    : "No updates posted";

  return (
    <div
      className={`${classes.card} ${statusClasses[schedule.status]}`}
    >
      <div className={classes.header}>
        <div className={classes.heading}>
          <h2 className={classes.title}>
            {statusLabels[schedule.status]}
          </h2>

          <p className={classes.text}>
            {schedule.summary}
          </p>
        </div>

        <span className={classes.badge}>
          {badgeLabels[schedule.status]}
        </span>
      </div>

      <div className={classes.metaGrid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>
            Next update due
          </div>

          <div className={classes.metaValue}>
            {nextUpdateText}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>
            Last update
          </div>

          <div className={classes.metaValue}>
            {lastUpdateText}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>
            Updates posted
          </div>

          <div className={classes.metaValue}>
            {schedule.completedUpdateCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestProgressUpdateScheduleCard;