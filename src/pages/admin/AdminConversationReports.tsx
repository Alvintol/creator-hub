import { useState } from "react";
import { Link } from "react-router-dom";
import {
  conversationReportReasonOptions,
  conversationReportStatusOptions,
  getConversationReportReasonLabel,
  getConversationReportStatusLabel,
  type ConversationReportReasonCode,
  type ConversationReportStatus,
} from "../../domain/conversations/conversations";
import {
  useAdminConversationReports,
  type AdminConversationReportFilters,
} from "../../hooks/admin/useAdminConversationReports";

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

  filtersGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  grid: "grid gap-4 lg:grid-cols-2",
  reportCard: "card p-5",
  title: "text-lg font-extrabold tracking-tight",
  textMuted: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  row: "flex flex-wrap items-center gap-3",
  pagerText: "text-sm text-zinc-600",

  statusPill:
    "inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800",

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const pageSize = 20;

const initialFilters: AdminConversationReportFilters = {
  reporterHandle: "",
  reportedHandle: "",
  status: "all",
  reason: "all",
};

const dateText = (value: string) => {
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

const profileText = (
  profile: { handle: string | null; display_name: string | null; user_id: string } | null,
  fallbackUserId: string
) => profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

const AdminConversationReports = () => {
  const [filters, setFilters] = useState<AdminConversationReportFilters>(
    initialFilters
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminConversationReports({
    filters,
    page,
    pageSize,
  });

  const setField = <Key extends keyof AdminConversationReportFilters>(
    key: Key,
    value: AdminConversationReportFilters[Key]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  };

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className={classes.backLink}>
        ← Back to admin dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Conversation reports</h1>
        <p className={classes.sub}>
          Review reports by reporter, reported user, reason, and status.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="reporterHandle">
                Reporter username
              </label>
              <input
                id="reporterHandle"
                className={classes.input}
                value={filters.reporterHandle}
                onChange={(event) => setField("reporterHandle", event.target.value)}
                placeholder="@reporter"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reportedHandle">
                Reported username
              </label>
              <input
                id="reportedHandle"
                className={classes.input}
                value={filters.reportedHandle}
                onChange={(event) => setField("reportedHandle", event.target.value)}
                placeholder="@reported"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className={classes.select}
                value={filters.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target.value as "all" | ConversationReportStatus
                  )
                }
              >
                <option value="all">All statuses</option>
                {conversationReportStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reason">
                Reason
              </label>
              <select
                id="reason"
                className={classes.select}
                value={filters.reason}
                onChange={(event) =>
                  setField(
                    "reason",
                    event.target.value as "all" | ConversationReportReasonCode
                  )
                }
              >
                <option value="all">All reasons</option>
                {conversationReportReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              Reset filters
            </button>

            <div className={classes.pagerText}>
              {isLoading ? "Loading…" : `${totalCount} report(s) found`}
            </div>

            {pageCount > 0 && (
              <div className={classes.pagerText}>
                Page {page} of {pageCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Reports could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading reports…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>No reports matched the current filters.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.report.id} className={classes.reportCard}>
                <h2 className={classes.title}>
                  {item.report.message_id ? "Message report" : "Conversation report"}
                </h2>

                <p className={classes.textMuted}>
                  Reporter: {profileText(item.reporter, item.report.reporter_user_id)}
                </p>

                <p className={classes.textMuted}>
                  Reported user:{" "}
                  {profileText(item.reportedUser, item.report.reported_user_id)}
                </p>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Status</div>
                    <div className={classes.statusPill}>
                      {getConversationReportStatusLabel(item.report.status)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Reason</div>
                    <div className={classes.metaValue}>
                      {getConversationReportReasonLabel(item.report.reason_code)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Reported</div>
                    <div className={classes.metaValue}>
                      {dateText(item.report.created_at)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Conversation</div>
                    <div className={classes.metaValue}>
                      {item.conversation?.subject ?? item.conversation?.conversation_type ?? "Unknown"}
                    </div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/reports/${item.report.id}`}
                  >
                    Review report
                  </Link>

                  {item.conversation?.listing_request_id && (
                    <Link
                      className={classes.btnOutline}
                      to={`/admin/requests/${item.conversation.listing_request_id}`}
                    >
                      View request
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className={classes.btnOutline}
              type="button"
              disabled={pageCount === 0 || page >= pageCount}
              onClick={() =>
                setPage((current) =>
                  pageCount > 0 ? Math.min(pageCount, current + 1) : current
                )
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminConversationReports;