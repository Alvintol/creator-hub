import type {
  ListingRequestProgressUpdateKind,
} from "../../../hooks/creatorRequests/useCreateListingRequestProgressUpdate";
import type {
  ListingRequestProgressUpdateRow,
} from "../../../hooks/creatorRequests/useListingRequestProgressUpdates";

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
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemDate: "text-xs text-zinc-500",
  body: "mt-3 whitespace-pre-wrap text-sm text-zinc-700",
  badges: "flex flex-wrap items-center gap-2",
  badge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  progressBadge:
    "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  empty:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  loading:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700",
} as const;

const updateKindLabels: Record<
  ListingRequestProgressUpdateKind,
  string
> = {
  progress: "Progress update",
  milestone: "Milestone update",
  delay: "Schedule update",
  final_preview: "Final preview",
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Project progress updates could not be loaded.";

const sortUpdatesNewestFirst = (
  updates: ListingRequestProgressUpdateRow[]
): ListingRequestProgressUpdateRow[] =>
  [...updates].sort((firstUpdate, secondUpdate) =>
    secondUpdate.created_at.localeCompare(
      firstUpdate.created_at
    )
  );

const ListingRequestProgressUpdateTimeline = ({
  updates,
  isLoading = false,
  error,
}: ListingRequestProgressUpdateTimelineProps) => {
  const sortedUpdates = sortUpdatesNewestFirst(updates);

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Project progress</h2>

          <p className={classes.text}>
            Creator updates recorded throughout the active project.
          </p>
        </div>

        {isLoading && (
          <div className={classes.loading}>
            Loading project progress updates…
          </div>
        )}
        
        {!isLoading && Boolean(error) && (
          <div className={classes.error}>
            {getErrorMessage(error)}
          </div>
        )}

        {!isLoading &&
          !error &&
          sortedUpdates.length === 0 && (
            <div className={classes.empty}>
              No project progress updates have been posted yet.
            </div>
          )}

        {!isLoading &&
          !error &&
          sortedUpdates.length > 0 && (
            <div className={classes.list}>
              {sortedUpdates.map((update) => (
                <article
                  className={classes.item}
                  key={update.id}
                >
                  <div className={classes.itemHeader}>
                    <div className={classes.itemHeading}>
                      <h3 className={classes.itemTitle}>
                        {update.title}
                      </h3>

                      <div className={classes.itemDate}>
                        {formatDate(update.created_at)}
                      </div>
                    </div>

                    <div className={classes.badges}>
                      <span className={classes.badge}>
                        {updateKindLabels[update.update_kind]}
                      </span>

                      {update.progress_percent !== null && (
                        <span className={classes.progressBadge}>
                          {update.progress_percent}% complete
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={classes.body}>
                    {update.body}
                  </p>
                </article>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestProgressUpdateTimeline;