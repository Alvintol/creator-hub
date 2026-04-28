import { Link } from "react-router-dom";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  title: "text-base font-extrabold tracking-tight",
  text: "mt-1 text-sm text-zinc-600",

  row: "mt-5 flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  pills: "mt-3 flex flex-wrap gap-2",
  pill: "chip",
  loadingText: "text-sm text-zinc-600",
} as const;

const CreatorDashboard = () => {
  const { isLoading, sellerApplication, creatorStatusLabel } = useSellerAccess();

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Creator dashboard</h1>

        <p className={classes.sub}>
          This space is reserved for approved creators and will become the home
          for creator tools.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.title}>Access confirmed</div>

        <p className={classes.text}>
          Your account currently has creator access. You can now create private
          draft listings and review them from your creator listings area.
        </p>

        <div className={classes.pills}>
          <span className={classes.pill}>{creatorStatusLabel}</span>

          {sellerApplication?.submitted_at && (
            <span className={classes.pill}>
              Submitted: {sellerApplication.submitted_at}
            </span>
          )}
        </div>

        <div className={classes.row}>
          <Link className={classes.btnPrimary} to="/creator/listings/new">
            Create listing
          </Link>

          <Link className={classes.btnOutline} to="/creator/listings">
            My listings
          </Link>

          <Link className={classes.btnOutline} to="/market">
            Browse market
          </Link>

          <Link className={classes.btnOutline} to="/creator/requests">
            Requests
          </Link>

          <Link className={classes.btnOutline} to="/settings/profile">
            Profile settings
          </Link>

          <Link className={classes.btnOutline} to="/apply/creator">
            View application
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CreatorDashboard;