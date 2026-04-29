import { Link } from "react-router-dom";
import { useAdminListingMetrics } from "../../hooks/admin/useAdminListingMetrics";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  statsGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
  statCard: "card p-6",
  statLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  statValue: "mt-2 text-3xl font-extrabold tracking-tight text-zinc-900",
  statHelp: "mt-2 text-sm text-zinc-600",

  toolsGrid: "grid gap-4 lg:grid-cols-2",
  toolCard: "card p-6",
  toolTitle: "text-lg font-extrabold tracking-tight",
  toolText: "mt-2 text-sm text-zinc-600",
  row: "mt-4 flex flex-wrap items-center gap-3",

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const AdminDashboard = () => {
  const { data, isLoading, error } = useAdminListingMetrics();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Admin dashboard</h1>

        <p className={classes.sub}>
          Review creator applications, monitor listings, and investigate listing
          revision history from one place.
        </p>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Dashboard metrics could not be loaded right now.
        </div>
      )}

      {isLoading && (
        <div className={classes.loadingText}>Loading dashboard metrics…</div>
      )}

      <div className={classes.statsGrid}>
        <div className={classes.statCard}>
          <div className={classes.statLabel}>Total listings</div>
          <div className={classes.statValue}>{data?.totalListings ?? 0}</div>
          <div className={classes.statHelp}>
            All listings across draft and published states.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Published listings</div>
          <div className={classes.statValue}>{data?.publishedListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings currently in published status.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Draft listings</div>
          <div className={classes.statValue}>{data?.draftListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings still in private creator draft mode.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Active listings</div>
          <div className={classes.statValue}>{data?.activeListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings currently visible through public listing reads.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Inactive listings</div>
          <div className={classes.statValue}>{data?.inactiveListings ?? 0}</div>
          <div className={classes.statHelp}>
            Listings hidden from the public market.
          </div>
        </div>

        <div className={classes.statCard}>
          <div className={classes.statLabel}>Listing revisions</div>
          <div className={classes.statValue}>{data?.totalRevisions ?? 0}</div>
          <div className={classes.statHelp}>
            Private audit trail entries for creator and admin review.
          </div>
        </div>
      </div>

      <div className={classes.toolsGrid}>
        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Creator applications</h2>

          <p className={classes.toolText}>
            Review incoming creator applications and continue the approval flow.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/creator-applications">
              Review applications
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Listings and revisions</h2>

          <p className={classes.toolText}>
            Search listings by username, dates, types, pricing, and visibility,
            then drill into revision history for dispute support.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/listings">
              Browse listings
            </Link>
          </div>
        </div>

        <div className={classes.toolCard}>
          <h2 className={classes.toolTitle}>Requests and snapshots</h2>

          <p className={classes.toolText}>
            Review buyer requests, creator responses, decline reasons, and frozen
            listing snapshots for dispute support.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/admin/requests">
              Review requests
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;