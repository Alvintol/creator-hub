import { Link } from "react-router-dom";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  card: "card p-6",
  sectionTitle: "sectionHeading",
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

          <Link className={classes.linkCard} to="/policies/refunds">
            <div className={classes.linkTitle}>
              Refund, Cancellation and Dispute Policy
            </div>
            <div className={classes.linkText}>
              Cancellations, partial refunds, revisions and how disputes are
              handled.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/policies/fees">
            <div className={classes.linkTitle}>
              Fee Schedule and Payment Terms
            </div>
            <div className={classes.linkText}>
              What buyers pay, what creators receive, and how fees are
              calculated.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/policies/copyright">
            <div className={classes.linkTitle}>
              Copyright Infringement and DMCA Policy
            </div>
            <div className={classes.linkText}>
              How to report infringing material and how CreatorHub responds.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/policies/cookies">
            <div className={classes.linkTitle}>Cookie and Tracking Policy</div>
            <div className={classes.linkText}>
              Browser storage, optional tracking, and how to change your
              choices.
            </div>
          </Link>

          <Link className={classes.linkCard} to="/policies/community">
            <div className={classes.linkTitle}>Community Guidelines</div>
            <div className={classes.linkText}>
              Plain-language standards for listings, messages, and content.
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Legal;