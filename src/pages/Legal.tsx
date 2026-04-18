import { Link } from "react-router-dom";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  sectionTitle: "text-base font-extrabold tracking-tight",
  sectionText: "mt-1 text-sm text-zinc-600",

  linkList: "mt-4 grid gap-3 md:grid-cols-2",
  linkCard:
    "rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50",
  linkTitle: "text-sm font-extrabold text-zinc-900",
  linkText: "mt-1 text-sm text-zinc-600",
} as const;

const Legal = () => {
  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Legal</h1>

        <p className={classes.sub}>
          Public policies and platform terms for CreatorHub.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.sectionTitle}>Policies and terms</div>

        <p className={classes.sectionText}>
          These pages explain how CreatorHub works, how user data is handled,
          and what rules apply to creators and buyers.
        </p>

        <div className={classes.linkList}>
          <Link className={classes.linkCard} to="/terms">
            <div className={classes.linkTitle}>Terms of Service</div>
            <div className={classes.linkText}>
              Platform-wide rules for using CreatorHub.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/privacy">
            <div className={classes.linkTitle}>Privacy Policy</div>
            <div className={classes.linkText}>
              How CreatorHub collects, uses, and protects information.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/terms/creator">
            <div className={classes.linkTitle}>Creator Terms</div>
            <div className={classes.linkText}>
              Rules and obligations for approved creators and applicants.
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Legal;