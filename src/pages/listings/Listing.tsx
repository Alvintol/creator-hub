import { Link, useParams } from "react-router-dom";
import { normalizeTwitchLogin } from "../../domain/twitch";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import {
  usePublicListing,
  type PublicListingRow,
} from "../../hooks/listings/usePublicListing";
import { getFulfilmentModeCopy } from '../../domain/listings/listings';
import { useState } from 'react';
import { ModerationReportReasonCode, moderationReportReasonOptions } from '../../domain/moderation/moderationReports';
import { useSubmitListingModerationReport } from '../../hooks/moderation/useSubmitListingModerationReport';
import { useAuth } from '../../providers/AuthProvider';

const classes = {
  notFoundWrap: "space-y-4",
  h1: "text-2xl font-extrabold tracking-tight",
  backBtn: "btnOutline",

  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",
  loadingText: "text-sm text-zinc-600",

  grid: "grid gap-6 lg:grid-cols-2",
  img: "w-full rounded-3xl border border-zinc-200 object-cover bg-zinc-100",

  rightCol: "space-y-4",
  titleRow: "flex flex-wrap items-center gap-2",
  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",
  liveBadge: "badge badgeLive",
  desc: "text-zinc-600",

  priceRow: "flex items-center justify-between gap-3",
  price: "text-xl font-extrabold",
  creatorLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  chips: "flex flex-wrap gap-2",
  chip: "chip",

  ctaBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  ctaTitle: "font-semibold",
  ctaText: "mt-1 text-sm text-zinc-600",
  ctaLink: "btnPrimary mt-3 inline-flex",

  liveCard: "overflow-hidden rounded-3xl border border-zinc-200 bg-white",
  liveImg: "h-48 w-full object-cover",
  liveBody: "p-4",
  liveMeta: "text-sm font-extrabold text-zinc-900",
  liveDot: "text-zinc-400",
  liveTitle: "mt-1 text-sm text-zinc-600",

  metaText: "text-sm text-zinc-500",
  reportCard: "card p-5",
  reportTitle: "text-base font-extrabold tracking-tight",
  reportText: "mt-1 text-sm text-zinc-600",
  reportForm: "mt-4 space-y-3",
  label: "text-sm font-bold text-zinc-900",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  textarea:
    "min-h-[110px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
  hint: "text-xs text-zinc-500",
  successCard:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-600 bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.24)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(220,38,38,0.32)] disabled:cursor-not-allowed disabled:opacity-60",
  field: "space-y-2",
  row: "flex flex-wrap items-center gap-3",
} as const;

// Formats the listing price for display
const priceText = (listing: PublicListingRow): string =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : listing.price_type === "range"
        ? `$${listing.price_min}–$${listing.price_max ?? listing.price_min}`
        : "";

// Formats the updated timestamp for buyer-facing display
const updatedText = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const ListingNotFound = () => (
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Listing not found</h1>

    <Link to="/market" className={classes.backBtn}>
      Back to market
    </Link>
  </div>
);

const ListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { twitchByLogin } = useTwitchStreams();
  const { data, isLoading, error } = usePublicListing(id ?? null);

  const { user } = useAuth();
  const submitListingReport = useSubmitListingModerationReport();

  const defaultReportReason = moderationReportReasonOptions[0]?.value ?? null;

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<ModerationReportReasonCode | null>(defaultReportReason);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const listing = data?.listing ?? null;
  const reportDetailsTrimmed = reportDetails.trim();

  const canSubmitListingReport =
    Boolean(listing?.id && reportReason) &&
    reportDetailsTrimmed.length <= 2000 &&
    !submitListingReport.isPending;

  const handleSubmitListingReport = async () => {
    if (!listing?.id || !reportReason || !canSubmitListingReport) return;

    setReportSuccess(null);
    setReportError(null);

    try {
      await submitListingReport.mutateAsync({
        listingId: listing.id,
        reasonCode: reportReason,
        reasonDetails: reportDetailsTrimmed,
      });

      setReportSuccess(
        "Listing report submitted. An admin will review it soon."
      );
      setReportDetails("");
      setIsReportOpen(false);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "Listing report could not be submitted."
      );
    }
  };

  if (!id) return <ListingNotFound />;

  if (isLoading) {
    return (
      <div className={classes.page}>
        <div className={classes.loadingText}>Loading…</div>
      </div>
    );
  }

  if (error || !listing || !data) return <ListingNotFound />;

  const { creator, platformAccounts } = data;
  const fulfilmentCopy = getFulfilmentModeCopy(listing.fulfilment_mode);

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw
    ? normalizeTwitchLogin(twitchLoginRaw)
    : null;

  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = Boolean(stream);

  const creatorName = creator?.display_name ?? creator?.handle ?? "Creator";
  const creatorLink = creator?.handle ? `/creator/${creator.handle}` : null;

  return (
    <div className={classes.page}>
      <Link to="/market" className={classes.backLink}>
        ← Back
      </Link>

      <div className={classes.grid}>
        <img
          src={listing.preview_url ?? ""}
          alt=""
          className={classes.img}
          loading="lazy"
        />

        <div className={classes.rightCol}>
          <div className={classes.titleRow}>
            <h1 className={classes.h1}>{listing.title}</h1>

            <span className={classes.badge}>{listing.offering_type}</span>

            {isLive && <span className={classes.liveBadge}>Live</span>}
          </div>

          <p className={classes.desc}>{listing.short}</p>

          <div className={classes.priceRow}>
            <div className={classes.price}>{priceText(listing)}</div>

            {creatorLink ? (
              <Link to={creatorLink} className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""} →
              </Link>
            ) : (
              <span className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""}
              </span>
            )}
          </div>

          <p className={classes.metaText}>
            Last updated: {updatedText(listing.updated_at)}
          </p>

          <div className={classes.chips}>
            <span className={classes.chip}>{listing.category}</span>

            {listing.video_subtype && (
              <span className={classes.chip}>{listing.video_subtype}</span>
            )}

            {listing.deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>

          {isLive && stream?.thumbnailUrl && (
            <div className={classes.liveCard}>
              <img
                src={stream.thumbnailUrl
                  .replace("{width}", "960")
                  .replace("{height}", "540")}
                alt=""
                className={classes.liveImg}
                loading="lazy"
              />

              <div className={classes.liveBody}>
                <div className={classes.liveMeta}>
                  {stream.gameName ?? ""}
                  <span className={classes.liveDot}> • </span>
                  {stream.viewerCount ?? 0} viewers
                </div>

                {stream.title && (
                  <p className={classes.liveTitle}>{stream.title}</p>
                )}
              </div>
            </div>
          )}

          <div className={classes.ctaBox}>
            <div className={classes.ctaTitle}>{fulfilmentCopy.title}</div>

            <p className={classes.ctaText}>{fulfilmentCopy.text}</p>

            {listing.fulfilment_mode === "request" ? (
              <Link to={`/listing/${listing.id}/request`} className={classes.ctaLink}>
                Submit request
              </Link>
            ) : (
              <span className={classes.ctaLink}>{fulfilmentCopy.primaryLabel}</span>
            )}
          </div>

          <div className={classes.reportCard}>
            <h2 className={classes.reportTitle}>Report listing</h2>

            <p className={classes.reportText}>
              Report this listing if it appears unsafe, misleading, stolen, abusive, or
              against CreatorHub rules. Reporting does not automatically hide the listing.
            </p>

            {reportSuccess && (
              <div className={classes.successCard}>{reportSuccess}</div>
            )}

            {reportError && (
              <div className={classes.errorCard}>{reportError}</div>
            )}

            {!user ? (
              <div className={classes.reportForm}>
                <p className={classes.reportText}>
                  You need to sign in before reporting a listing.
                </p>

                <Link className={classes.btnOutline} to="/signin">
                  Sign in to report
                </Link>
              </div>
            ) : (
              <div className={classes.reportForm}>
                {!isReportOpen ? (
                  <button
                    className={classes.btnOutline}
                    type="button"
                    onClick={() => {
                      setIsReportOpen(true);
                      setReportSuccess(null);
                      setReportError(null);
                    }}
                  >
                    Report listing
                  </button>
                ) : (
                  <>
                    <div className={classes.field}>
                      <label className={classes.label} htmlFor="listingReportReason">
                        Reason
                      </label>

                      <select
                        id="listingReportReason"
                        className={classes.select}
                        value={reportReason ?? ""}
                        onChange={(event) =>
                          setReportReason(
                            event.target.value as ModerationReportReasonCode
                          )
                        }
                      >
                        {moderationReportReasonOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={classes.field}>
                      <label className={classes.label} htmlFor="listingReportDetails">
                        Details
                      </label>

                      <textarea
                        id="listingReportDetails"
                        className={classes.textarea}
                        value={reportDetails}
                        onChange={(event) => setReportDetails(event.target.value)}
                        placeholder="Optional. Add context that will help admins review this report."
                        maxLength={2000}
                      />

                      <div className={classes.hint}>
                        {reportDetailsTrimmed.length}/2000 characters.
                      </div>
                    </div>

                    <div className={classes.row}>
                      <button
                        className={classes.btnDanger ?? classes.btnPrimary}
                        type="button"
                        disabled={!canSubmitListingReport}
                        onClick={() => void handleSubmitListingReport()}
                      >
                        {submitListingReport.isPending
                          ? "Submitting…"
                          : "Submit report"}
                      </button>

                      <button
                        className={classes.btnOutline}
                        type="button"
                        disabled={submitListingReport.isPending}
                        onClick={() => {
                          setIsReportOpen(false);
                          setReportError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPage;