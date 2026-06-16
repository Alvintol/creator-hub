type ListingRequestSubmissionDetailsProps = {
  heading: string;
  requestTitle?: string | null;
  requestDetails?: string | null;
  fallbackMessage?: string | null;
  requestedTimeline?: string | null;
  budgetAmount?: number | string | null;
  referenceLinks?: string[] | null;
};

const classes = {
  section: "space-y-4",
  header: "space-y-1",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  titleBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-900",
  detailsBox:
    "whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700",
  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",
  list: "space-y-2",
  link:
    "block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100",
} as const;

const cleanText = (value?: string | null): string => value?.trim() ?? "";

const cleanLinks = (links?: string[] | null): string[] =>
  (links ?? []).map((link) => link.trim()).filter(Boolean);

const formatBudgetAmount = (
  value?: number | string | null
): string => {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Not provided";
  }

  return numericValue % 1 === 0
    ? `$${numericValue}`
    : `$${numericValue.toFixed(2)}`;
};

const ListingRequestSubmissionDetails = ({
  heading,
  requestTitle,
  requestDetails,
  fallbackMessage,
  requestedTimeline,
  budgetAmount,
  referenceLinks,
}: ListingRequestSubmissionDetailsProps) => {
  const titleText = cleanText(requestTitle);
  const detailsText = cleanText(requestDetails) || cleanText(fallbackMessage);
  const timelineText = cleanText(requestedTimeline);
  const links = cleanLinks(referenceLinks);

  return (
    <div className={classes.section}>
      <div className={classes.header}>
        <h2 className={classes.sectionTitle}>{heading}</h2>
        <p className={classes.text}>
          Structured request details submitted by the buyer.
        </p>
      </div>

      <div className={classes.metaBlock}>
        <div className={classes.metaLabel}>Request Title / Summary</div>
        <div className={classes.titleBox}>
          {titleText || "No request summary provided."}
        </div>
      </div>

      <div className={classes.metaBlock}>
        <div className={classes.metaLabel}>Details</div>
        <div className={classes.detailsBox}>
          {detailsText || "No request details provided."}
        </div>
      </div>

      <div className={classes.metaGrid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Requested Timeline</div>
          <div className={classes.metaValue}>
            {timelineText || "Not provided"}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Budget</div>
          <div className={classes.metaValue}>
            {formatBudgetAmount(budgetAmount)}
          </div>
        </div>
      </div>

      <div className={classes.metaBlock}>
        <div className={classes.metaLabel}>Reference Links</div>

        {links.length > 0 ? (
          <div className={classes.list}>
            {links.map((link) => (
              <a
                key={link}
                className={classes.link}
                href={link}
                target="_blank"
                rel="noreferrer"
              >
                {link}
              </a>
            ))}
          </div>
        ) : (
          <div className={classes.metaValue}>No Reference Links Provided.</div>
        )}
      </div>
    </div>
  );
};

export default ListingRequestSubmissionDetails;