import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { usePublicListing } from "../../hooks/listings/usePublicListing";
import { useCreateListingRequest } from "../../hooks/listings/useCreateListingRequest";
import { buildListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import { useAuth } from "../../providers/AuthProvider";

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  hint: "text-xs text-zinc-500",
  error: "text-xs font-semibold text-red-600",
  textarea:
    "min-h-[180px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  infoBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  infoTitle: "text-sm font-bold text-zinc-900",
  infoText: "mt-1 text-sm text-zinc-600",

  submitError:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  successBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
} as const;

const RequestListing = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data, isLoading, error } = usePublicListing(id ?? null);
  const createRequestMutation = useCreateListingRequest();

  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const listing = data?.listing ?? null;
  const creator = data?.creator ?? null;

  const creatorName = creator?.handle
    ? `@${creator.handle}`
    : creator?.display_name ?? "this creator";

  const validate = () => {
    const trimmed = message.trim();

    if (trimmed.length < 10 || trimmed.length > 2000) {
      setMessageError("Message must be between 10 and 2000 characters.");
      return null;
    }

    setMessageError(null);
    return trimmed;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!listing) return;

    const nextMessage = validate();
    if (!nextMessage) return;

    try {
      await createRequestMutation.mutateAsync({
        listingId: listing.id,
        creatorUserId: listing.user_id,
        message: nextMessage,
        listingSnapshot: buildListingRequestSnapshot(listing),
      });

      setIsSubmitted(true);
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/market" className={classes.backLink}>
          ← Back to market
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.sub}>
            This listing is not available for requests right now.
          </p>
        </div>
      </div>
    );
  }

  if (listing.fulfilment_mode !== "request") {
    return (
      <div className={classes.page}>
        <Link to={`/listing/${listing.id}`} className={classes.backLink}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request flow unavailable</h1>
          <p className={classes.sub}>
            This listing is not using the request-based flow.
          </p>
        </div>
      </div>
    );
  }

  if (user?.id === listing.user_id) {
    return (
      <div className={classes.page}>
        <Link to={`/listing/${listing.id}`} className={classes.backLink}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Own listing</h1>
          <p className={classes.sub}>
            You cannot submit a buyer request for your own listing.
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className={classes.page}>
        <Link to={`/listing/${listing.id}`} className={classes.backLink}>
          ← Back to listing
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request submitted</h1>

          <div className={classes.successBox}>
            Your request has been sent to {creatorName}.
          </div>

          <div className={classes.section}>
            <p className={classes.text}>
              A frozen snapshot of the listing was recorded with your request so
              the creator can review the exact version you reached out about.
            </p>

            <div className={classes.row}>
              <Link className={classes.btnPrimary} to="/requests">
                View my requests
              </Link>

              <Link className={classes.btnOutline} to={`/listing/${listing.id}`}>
                Back to listing
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link to={`/listing/${listing.id}`} className={classes.backLink}>
        ← Back to listing
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Request this listing</h1>

        <p className={classes.sub}>
          Send a request to {creatorName} about {listing.title}.
        </p>
      </div>

      <form className={classes.card} onSubmit={handleSubmit}>
        <div className={classes.section}>
          <div className={classes.infoBox}>
            <div className={classes.infoTitle}>Snapshot protection</div>

            <div className={classes.infoText}>
              Submitting this request records the listing details as they appear
              right now, including pricing and listing content.
            </div>
          </div>

          <div className={classes.field}>
            <label className={classes.label} htmlFor="message">
              Request message
            </label>

            <textarea
              id="message"
              className={classes.textarea}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe what you need, your intended use, timelines, and any questions for the creator."
              maxLength={2000}
            />

            <div className={classes.hint}>10 to 2000 characters.</div>

            {messageError && <div className={classes.error}>{messageError}</div>}
          </div>

          {createRequestMutation.error && (
            <div className={classes.submitError}>
              Your request could not be submitted right now.
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
  );
};

export default RequestListing;