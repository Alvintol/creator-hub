import type { ListingRequestProgressUpdateRow } from "../hooks/creatorRequests/useListingRequestProgressUpdates";

type ListingRequestProgressUpdateTimelineProps = {
  updates: ListingRequestProgressUpdateRow[];
  isLoading?: boolean;
  error?: unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  loadingText: "text-sm text-zinc-600",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  emptyBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemMeta: "text-xs text-zinc-500",
  badgeRow: "flex flex-wrap items-center gap-2",
  kindBadge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  progressBadge:
    "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  body:
    "mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700",
} as const;

const updateKindLabels: Record<
  ListingRequestProgressUpdateRow["update_kind"],
  string
> = {
  progress: "Progress update",
  milestone: "Milestone update",
  delay: "Schedule update",
  final_preview: "Final preview",
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

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Project progress updates could not be loaded.";

const ListingRequestProgressUpdateTimeline = ({
  updates,
  isLoading = false,
  error,
}: ListingRequestProgressUpdateTimelineProps) => {
  if (isLoading) {
    return (
      <div className={classes.card}>
        <div className={classes.loadingText}>
          Loading project progress updates…
        </div>
      </div>
    );
  }

  const sortedUpdates = [...updates].sort(
    (firstUpdate, secondUpdate) =>
      secondUpdate.created_at.localeCompare(
        firstUpdate.created_at
      )
  );

  const hasError = error !== null && error !== undefined;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Project progress updates
          </h2>

          <p className={classes.text}>
            Creator updates recorded throughout the active
            project.
          </p>
        </div>

        {hasError && (
          <div className={classes.errorBox}>
            {getErrorMessage(error)}
          </div>
        )}

        {!hasError && sortedUpdates.length === 0 && (
          <div className={classes.emptyBox}>
            No project progress updates have been posted yet.
          </div>
        )}

        {!hasError && sortedUpdates.length > 0 && (
          <div className={classes.list}>
            {sortedUpdates.map((update) => (
              <article
                key={update.id}
                className={classes.item}
              >
                <div className={classes.itemHeader}>
                  <div className={classes.itemHeading}>
                    <h3 className={classes.itemTitle}>
                      {update.title}
                    </h3>

                    <div className={classes.itemMeta}>
                      Posted {formatDateTime(update.created_at)}
                    </div>
                  </div>

                  <div className={classes.badgeRow}>
                    <span className={classes.kindBadge}>
                      {updateKindLabels[update.update_kind]}
                    </span>

                    {update.progress_percent !== null && (
                      <span className={classes.progressBadge}>
                        {update.progress_percent}% complete
                      </span>
                    )}
                  </div>
                </div>

                <div className={classes.body}>
                  {update.body}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListingRequestProgressUpdateTimeline;