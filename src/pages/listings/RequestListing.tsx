import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateListingRequest } from "../../hooks/listings/useCreateListingRequest";
import {
  usePublicListing,
  type PublicListingRow,
} from "../../hooks/listings/usePublicListing";
import { buildListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import { useAuth } from "../../providers/AuthProvider";

type FormErrors = {
  requestTitle?: string;
  requestDetails?: string;
  requestedTimeline?: string;
  budgetAmount?: string;
  referenceLinks?: string;
};

type ValidRequestForm = {
  requestTitle: string;
  requestDetails: string;
  requestedTimeline?: string;
  budgetAmount: number | null;
  referenceLinks: string[];
};

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",
  grid: "grid gap-6 lg:grid-cols-[0.85fr_1.15fr]",
  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",
  list: "space-y-2",
  listItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  hint: "text-xs text-zinc-500",
  error: "text-xs font-semibold text-red-600",
  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  textarea:
    "min-h-[180px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  smallTextarea:
    "min-h-[110px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  infoBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  infoTitle: "text-sm font-bold text-zinc-900",
  infoText: "mt-1 text-sm text-zinc-600",
  submitError:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  loadingText: "text-sm text-zinc-600",
} as const;

const priceText = (listing: PublicListingRow): string =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : `$${listing.price_min}–${listing.price_max ?? listing.price_min}`;

const parseReferenceLinks = (value: string): string[] =>
  value
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean)
    .slice(0, 5);

const isValidReferenceUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const RequestListing = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, error } = usePublicListing(id ?? null);
  const createRequestMutation = useCreateListingRequest();

  const [requestTitle, setRequestTitle] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestedTimeline, setRequestedTimeline] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [referenceLinksText, setReferenceLinksText] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const listing = data?.listing ?? null;
  const creator = data?.creator ?? null;

  const creatorName = creator?.handle
    ? `@${creator.handle}`
    : creator?.display_name ?? "this creator";

  const validate = (): ValidRequestForm | null => {
    const nextErrors: FormErrors = {};

    const trimmedTitle = requestTitle.trim();
    const trimmedDetails = requestDetails.trim();
    const trimmedTimeline = requestedTimeline.trim();
    const trimmedBudget = budgetText.trim();
    const referenceLinks = parseReferenceLinks(referenceLinksText);

    if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
      nextErrors.requestTitle =
        "Summary must be between 3 and 120 characters.";
    }

    if (trimmedDetails.length < 10 || trimmedDetails.length > 2000) {
      nextErrors.requestDetails =
        "Details must be between 10 and 2000 characters.";
    }

    if (trimmedTimeline.length > 160) {
      nextErrors.requestedTimeline =
        "Timeline must be 160 characters or fewer.";
    }

    const budgetAmount = trimmedBudget ? Number(trimmedBudget) : null;

    if (
      trimmedBudget &&
      (!Number.isFinite(budgetAmount) ||
        Number(budgetAmount) < 0 ||
        Number(budgetAmount) > 999999.99)
    ) {
      nextErrors.budgetAmount =
        "Budget must be a valid amount between 0 and 999999.99.";
    }

    if (referenceLinks.length > 5) {
      nextErrors.referenceLinks = "Add up to 5 reference links.";
    }

    if (referenceLinks.some((link) => !isValidReferenceUrl(link))) {
      nextErrors.referenceLinks =
        "Reference links must start with http:// or https://.";
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      requestTitle: trimmedTitle,
      requestDetails: trimmedDetails,
      requestedTimeline: trimmedTimeline || undefined,
      budgetAmount,
      referenceLinks,
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!listing) {
      return;
    }

    const validForm = validate();

    if (!validForm) {
      return;
    }

    try {
      const requestId = await createRequestMutation.mutateAsync({
        listingId: listing.id,
        creatorUserId: listing.user_id,
        requestTitle: validForm.requestTitle,
        requestDetails: validForm.requestDetails,
        requestedTimeline: validForm.requestedTimeline,
        budgetAmount: validForm.budgetAmount,
        referenceLinks: validForm.referenceLinks,
        listingSnapshot: buildListingRequestSnapshot(listing),
      });

      navigate(`/requests/${requestId}`);
    } catch {
      // Error is surfaced below.
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link className={classes.backLink} to="/market">
          ← Back to market
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.text}>
            This listing is not available for requests right now.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={classes.page}>
        <Link className={classes.backLink} to={`/listing/${listing.id}`}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Sign in to submit a request</h1>
          <p className={classes.text}>
            You need to be signed in before sending a buyer request to{" "}
            {creatorName}.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/signin">
              Sign in
            </Link>
            <Link className={classes.btnOutline} to={`/listing/${listing.id}`}>
              Back to listing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (listing.fulfilment_mode !== "request") {
    return (
      <div className={classes.page}>
        <Link className={classes.backLink} to={`/listing/${listing.id}`}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request flow unavailable</h1>
          <p className={classes.text}>
            This listing is not using the request-based flow.
          </p>
        </div>
      </div>
    );
  }

  if (user.id === listing.user_id) {
    return (
      <div className={classes.page}>
        <Link className={classes.backLink} to={`/listing/${listing.id}`}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Own listing</h1>
          <p className={classes.text}>
            You cannot submit a buyer request for your own listing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link className={classes.backLink} to={`/listing/${listing.id}`}>
        ← Back to listing
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Request this listing</h1>
        <p className={classes.sub}>
          Send a structured request to {creatorName} about {listing.title}.
        </p>
      </div>

      <div className={classes.grid}>
        <aside className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Listing context</h2>
            <p className={classes.text}>
              This is the listing snapshot your request will be tied to.
            </p>
          </div>

          <div className={classes.metaGrid}>
            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Title</div>
              <div className={classes.metaValue}>{listing.title}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Creator</div>
              <div className={classes.metaValue}>{creatorName}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Price</div>
              <div className={classes.metaValue}>{priceText(listing)}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Fulfilment</div>
              <div className={classes.metaValue}>{listing.fulfilment_mode}</div>
            </div>
          </div>

          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Deliverables</h2>

            {listing.deliverables.length > 0 ? (
              <div className={classes.list}>
                {listing.deliverables.map((deliverable) => (
                  <div key={deliverable} className={classes.listItem}>
                    {deliverable}
                  </div>
                ))}
              </div>
            ) : (
              <p className={classes.text}>No deliverables were listed.</p>
            )}
          </div>

          <div className={classes.infoBox}>
            <div className={classes.infoTitle}>Snapshot protection</div>
            <p className={classes.infoText}>
              Submitting this request records the listing details as they appear
              right now, including pricing and deliverables.
            </p>
          </div>
        </aside>

        <form className={classes.card} onSubmit={(event) => void handleSubmit(event)}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Request details</h2>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="request-title">
                Request title / summary
              </label>
              <input
                id="request-title"
                className={classes.input}
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="Example: Custom cozy emote pack for Twitch launch"
                maxLength={120}
              />
              <div className={classes.hint}>3 to 120 characters.</div>
              {formErrors.requestTitle && (
                <div className={classes.error}>{formErrors.requestTitle}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="request-details">
                Details
              </label>
              <textarea
                id="request-details"
                className={classes.textarea}
                value={requestDetails}
                onChange={(event) => setRequestDetails(event.target.value)}
                placeholder="Describe what you need, intended use, style notes, required deliverables, and any important context for the creator."
                maxLength={2000}
              />
              <div className={classes.hint}>
                {requestDetails.trim().length}/2000 characters. Minimum 10.
              </div>
              {formErrors.requestDetails && (
                <div className={classes.error}>{formErrors.requestDetails}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="requested-timeline">
                Deadline / timeline optional
              </label>
              <input
                id="requested-timeline"
                className={classes.input}
                value={requestedTimeline}
                onChange={(event) => setRequestedTimeline(event.target.value)}
                placeholder="Example: Ideally before June 10, flexible"
                maxLength={160}
              />
              <div className={classes.hint}>Optional. 160 characters max.</div>
              {formErrors.requestedTimeline && (
                <div className={classes.error}>
                  {formErrors.requestedTimeline}
                </div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="budget-amount">
                Budget optional
              </label>
              <input
                id="budget-amount"
                className={classes.input}
                value={budgetText}
                onChange={(event) => setBudgetText(event.target.value)}
                placeholder={`Listing price context: ${priceText(listing)}`}
                inputMode="decimal"
              />
              <div className={classes.hint}>
                Optional. Leave blank if you want to use the listed pricing as
                context.
              </div>
              {formErrors.budgetAmount && (
                <div className={classes.error}>{formErrors.budgetAmount}</div>
              )}
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reference-links">
                References optional
              </label>
              <textarea
                id="reference-links"
                className={classes.smallTextarea}
                value={referenceLinksText}
                onChange={(event) => setReferenceLinksText(event.target.value)}
                placeholder="Paste up to 5 links, one per line."
              />
              <div className={classes.hint}>
                Optional for now. Use one http:// or https:// link per line.
              </div>
              {formErrors.referenceLinks && (
                <div className={classes.error}>{formErrors.referenceLinks}</div>
              )}
            </div>

            {createRequestMutation.error && (
              <div className={classes.submitError}>
                {createRequestMutation.error instanceof Error
                  ? createRequestMutation.error.message
                  : "Your request could not be submitted right now."}
              </div>
            )}

            <div className={classes.row}>
              <button
                className={classes.btnPrimary}
                type="submit"
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending
                  ? "Submitting request…"
                  : "Submit request"}
              </button>

              <Link className={classes.btnOutline} to={`/listing/${listing.id}`}>
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestListing;