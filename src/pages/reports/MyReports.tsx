import { Link } from "react-router-dom";
import {
  getModerationReportReasonLabel,
  getModerationReportResolutionLabel,
  getModerationReportStatusLabel,
  getModerationReportTargetTypeLabel,
} from "../../domain/moderation/moderationReports";
import { useMarkMyModerationReportsSeen, useMyModerationReports } from "../../hooks/moderation/useMyModerationReports";
import { useEffect } from 'react';

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  stack: "space-y-4",
  reportCard: "card p-5",
  title: "text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  textStrong: "text-sm font-bold text-zinc-900",

  metaGrid: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900 break-words",

  statusPill:
    "inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800",

  updateBox:
    "rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  statusPillBase:
    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
  statusSubmitted:
    "border-orange-200 bg-orange-50 text-orange-800",
  statusUnderReview:
    "border-blue-200 bg-blue-50 text-blue-800",
  statusResolved:
    "border-green-200 bg-green-50 text-green-800",
  statusDismissed:
    "border-zinc-300 bg-zinc-100 text-zinc-700",
  statusNeedsChanges:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusUnknown:
    "border-zinc-300 bg-zinc-100 text-zinc-700",
  newUpdatePill:
    "inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800",
} as const;

const dateText = (value: string | null) => {
  if (!value) return "Not set";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const reportStatusPillClass = (status: string) => {
  const statusClasses: Record<string, string> = {
    submitted: classes.statusSubmitted,
    under_review: classes.statusUnderReview,
    resolved: classes.statusResolved,
    dismissed: classes.statusDismissed,
    rejected: classes.statusDismissed,
    needs_changes: classes.statusNeedsChanges,
  };

  return `${classes.statusPillBase} ${statusClasses[status] ?? classes.statusUnknown
    }`;
};

const MyReports = () => {
  const { data: reports = [], isLoading, error } = useMyModerationReports();
  const markReportsSeen = useMarkMyModerationReportsSeen();

  const hasUnreadReportUpdates = reports.some(
    (report) => report.has_unread_update
  );

  useEffect(() => {
    if (isLoading || error || !hasUnreadReportUpdates) return;

    markReportsSeen.mutate();
  }, [isLoading, error, hasUnreadReportUpdates, markReportsSeen]);

  return (
    <div className={classes.page}>
      <Link to="/settings/profile" className={classes.backLink}>
        ← Back to settings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>My reports</h1>

        <p className={classes.sub}>
          Track reports you have submitted to CreatorHub moderation. Admin-only
          notes and internal actions are not shown here.
        </p>
      </div>

      {isLoading && (
        <div className={classes.card}>
          <div className={classes.loadingText}>Loading reports…</div>
        </div>
      )}

      {error && (
        <div className={classes.errorCard}>
          Your reports could not be loaded right now.
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>
            You have not submitted any reports yet.
          </p>
        </div>
      )}

      {!isLoading && !error && reports.length > 0 && (
        <div className={classes.stack}>
          {reports.map((report) => (
            <div key={report.id} className={classes.reportCard}>
              <h2 className={classes.title}>
                {getModerationReportTargetTypeLabel(report.target_type)}
              </h2>

              {report.has_unread_update && (
                    <div className={classes.statusPill}>
                      New moderator update
                    </div>
              )}

              <p className={classes.text}>
                Target:{" "}
                <span className={classes.textStrong}>
                  {report.target_label}
                </span>
              </p>

              <div className={classes.metaGrid}>
                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Status</div>
                  <div className={reportStatusPillClass(report.status)}>
                    {getModerationReportStatusLabel(report.status)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Reason</div>
                  <div className={classes.metaValue}>
                    {getModerationReportReasonLabel(report.reason_code)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Resolution</div>
                  <div className={classes.metaValue}>
                    {getModerationReportResolutionLabel(
                      report.resolution_code
                    )}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Submitted</div>
                  <div className={classes.metaValue}>
                    {dateText(report.created_at)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Resolved</div>
                  <div className={classes.metaValue}>
                    {dateText(report.resolved_at)}
                  </div>
                </div>
              </div>

              {report.reason_details && (
                <p className={classes.text}>
                  <span className={classes.textStrong}>Your details:</span>{" "}
                  {report.reason_details}
                </p>
              )}

              {report.reporter_status_message && (
                <div className={classes.updateBox}>
                  <strong>Moderator update:</strong>{" "}
                  {report.reporter_status_message}
                  {report.reporter_status_updated_at && (
                    <>
                      {" "}
                      <span>
                        Updated {dateText(report.reporter_status_updated_at)}.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReports;