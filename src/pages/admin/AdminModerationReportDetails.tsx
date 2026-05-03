import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getModerationReportReasonLabel,
  getModerationReportResolutionLabel,
  getModerationReportStatusLabel,
  getModerationReportTargetTypeLabel,
  moderationReportResolutionOptions,
  moderationReportStatusOptions,
  type ModerationReportResolutionCode,
  type ModerationReportStatus,
} from "../../domain/moderation/moderationReports";
import { useAdminModerationReport } from "../../hooks/admin/useAdminModerationReport";
import { useUpdateModerationReportStatus } from "../../hooks/admin/useUpdateModerationReportStatus";

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  grid: "grid gap-6 xl:grid-cols-[1fr_420px]",
  stack: "space-y-6",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  textStrong: "text-sm font-bold text-zinc-900",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900 break-words",

  statusPill:
    "inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800",

  reportedMessageBox:
    "rounded-2xl border-2 border-red-300 bg-red-50/70 px-4 py-3 text-sm text-red-800 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",

  thread: "space-y-3",
  messageRow: "flex",
  messageRowOwn: "justify-end",
  messageRowOther: "justify-start",
  messageRowSystem: "justify-center",
  messageBubble:
    "max-w-[min(100%,42rem)] rounded-2xl border px-4 py-3 shadow-sm",
  messageBubbleNormal: "border-zinc-200 bg-white",
  messageBubbleReported:
    "border-2 border-red-300 bg-red-50 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
  messageBubbleSystem:
    "border-zinc-200 bg-zinc-50 text-center shadow-none",
  messageMeta:
    "mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500",
  messageBody: "whitespace-pre-wrap text-sm leading-6 text-zinc-800",

  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  textarea:
    "min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
  hint: "text-xs text-zinc-500",
  row: "flex flex-wrap items-center gap-3",

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  successCard:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",
  updateCard:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800",
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

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId);

const AdminModerationReportDetails = () => {
  const { id } = useParams();

  const { data, isLoading, error } = useAdminModerationReport(id ?? null);
  const updateStatusMutation = useUpdateModerationReportStatus();

  const report = data?.report ?? null;
  const conversation = data?.conversation ?? null;
  const messages = data?.messages ?? [];
  const listing = data?.listing ?? null;
  const reporter = data?.reporter ?? null;
  const reportedUser = data?.reportedUser ?? null;
  const profilesByUserId = data?.profilesByUserId ?? {};
  const updates = data?.updates ?? [];

  const [status, setStatus] = useState<ModerationReportStatus>("submitted");
  const [resolutionCode, setResolutionCode] =
    useState<ModerationReportResolutionCode | "">("");
  const [reporterStatusMessage, setReporterStatusMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!report) return;

    setStatus(report.status);
    setResolutionCode(report.resolution_code ?? "");
    setReporterStatusMessage("");
    setAdminNotes("");
    setSavedMessage(null);
  }, [report]);

  const reporterStatusMessageTrimmed = reporterStatusMessage.trim();
  const adminNotesTrimmed = adminNotes.trim();

  const hasStatusChanged = report ? status !== report.status : false;

  const hasResolutionChanged = report
    ? resolutionCode !== (report.resolution_code ?? "")
    : false;

  const hasReporterUpdate = reporterStatusMessageTrimmed.length > 0;
  const hasAdminNote = adminNotesTrimmed.length > 0;

  const hasPendingUpdate =
    hasStatusChanged || hasResolutionChanged || hasReporterUpdate || hasAdminNote;

  const canSave =
    Boolean(report) &&
    reporterStatusMessageTrimmed.length <= 1000 &&
    adminNotesTrimmed.length <= 2000 &&
    !updateStatusMutation.isPending;

  const senderText = (senderUserId: string) =>
    profileText(profilesByUserId[senderUserId] ?? null, senderUserId);

  const handleSaveStatus = async () => {
    if (!report || !canSave) return;

    try {
      await updateStatusMutation.mutateAsync({
        reportId: report.id,
        status,
        resolutionCode,
        reporterStatusMessage: reporterStatusMessageTrimmed,
        adminNotes: adminNotesTrimmed,
      });

      setReporterStatusMessage("");
      setAdminNotes("");
      setSavedMessage("Report update logged.");
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return (
      <div className={classes.card}>
        <div className={classes.loadingText}>Loading report…</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={classes.card}>
        <h1 className={classes.h1}>Report detail</h1>
        <div className={classes.errorCard}>
          Report could not be loaded right now.
        </div>
      </div>
    );
  }

  const activeReport = report;

  const reportedMessage = report.message_id
    ? messages.find((message) => message.id === report.message_id) ?? null
    : null;

  return (
    <div className={classes.page}>
      <Link to="/admin/reports" className={classes.backLink}>
        ← Back to reports
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>
          {getModerationReportTargetTypeLabel(report.target_type)}
        </h1>

        <p className={classes.sub}>
          Review the report, context, reporter, reported user, and update the
          reporter-visible status.
        </p>
      </div>

      <div className={classes.grid}>
        <div className={classes.stack}>
          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Report summary</h2>

              <div className={classes.metaGrid}>
                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Status</div>
                  <div className={classes.statusPill}>
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
                  <div className={classes.metaLabel}>Reporter</div>
                  <div className={classes.metaValue}>
                    {profileText(reporter, report.reporter_user_id)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Reported user</div>
                  <div className={classes.metaValue}>
                    {profileText(reportedUser, report.reported_user_id)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Reported at</div>
                  <div className={classes.metaValue}>
                    {dateText(report.created_at)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Resolution</div>
                  <div className={classes.metaValue}>
                    {getModerationReportResolutionLabel(report.resolution_code)}
                  </div>
                </div>
              </div>

              <div>
                <div className={classes.metaLabel}>Reporter details</div>
                <p className={classes.text}>
                  {report.reason_details || "No additional report details provided."}
                </p>
              </div>
            </div>
          </div>

          {reportedMessage && (
            <div className={classes.reportedMessageBox}>
              <div className={classes.textStrong}>Reported message</div>
              <div className="mt-1">
                From {senderText(reportedMessage.sender_user_id)} ·{" "}
                {dateText(reportedMessage.created_at)}
              </div>
              <div className="mt-2 whitespace-pre-wrap">
                {reportedMessage.body || "[No text body]"}
              </div>
            </div>
          )}

          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Target context</h2>

              {conversation && (
                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Conversation</div>
                    <div className={classes.metaValue}>
                      {conversation.subject ?? conversation.conversation_type}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Conversation status</div>
                    <div className={classes.metaValue}>{conversation.status}</div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Last message</div>
                    <div className={classes.metaValue}>
                      {conversation.last_message_preview ?? "No message preview"}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Request link</div>
                    <div className={classes.metaValue}>
                      {conversation.listing_request_id ? (
                        <Link
                          className={classes.backLink}
                          to={`/admin/requests/${conversation.listing_request_id}`}
                        >
                          View linked request
                        </Link>
                      ) : (
                        "No linked request"
                      )}
                    </div>
                  </div>
                </div>
              )}

              {listing && (
                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Listing title</div>
                    <div className={classes.metaValue}>{listing.title}</div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Listing status</div>
                    <div className={classes.metaValue}>{listing.status}</div>
                  </div>
                </div>
              )}

              {!conversation && !listing && (
                <p className={classes.text}>
                  Target context is not available for this report type yet.
                </p>
              )}
            </div>
          </div>

          {messages.length > 0 && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>Conversation messages</h2>

                <div className={classes.thread}>
                  {messages.map((message) => {
                    const isReportedMessage = message.id === report.message_id;
                    const isSystemMessage = message.message_type === "system";

                    const rowClassName = `${classes.messageRow} ${isSystemMessage
                      ? classes.messageRowSystem
                      : message.sender_user_id === report.reported_user_id
                        ? classes.messageRowOther
                        : classes.messageRowOwn
                      }`;

                    const bubbleClassName = `${classes.messageBubble} ${isSystemMessage
                      ? classes.messageBubbleSystem
                      : isReportedMessage
                        ? classes.messageBubbleReported
                        : classes.messageBubbleNormal
                      }`;

                    return (
                      <div key={message.id} className={rowClassName}>
                        <div className={bubbleClassName}>
                          <div className={classes.messageMeta}>
                            <span>
                              {isSystemMessage
                                ? "System"
                                : senderText(message.sender_user_id)}
                            </span>
                            <span>·</span>
                            <span>{dateText(message.created_at)}</span>
                            {isReportedMessage && (
                              <>
                                <span>·</span>
                                <span>Reported message</span>
                              </>
                            )}
                          </div>

                          <div className={classes.messageBody}>
                            {message.body || "[No text body]"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Update report</h2>

            {savedMessage && (
              <div className={classes.successCard}>{savedMessage}</div>
            )}

            {updateStatusMutation.error && (
              <div className={classes.errorCard}>
                Report status could not be updated right now.
              </div>
            )}

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reportStatus">
                Status
              </label>

              <select
                id="reportStatus"
                className={classes.select}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ModerationReportStatus)
                }
              >
                {moderationReportStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="resolutionCode">
                Resolution
              </label>

              <select
                id="resolutionCode"
                className={classes.select}
                value={resolutionCode}
                onChange={(event) =>
                  setResolutionCode(
                    event.target.value as ModerationReportResolutionCode | ""
                  )
                }
              >
                <option value="">No resolution selected</option>

                {moderationReportResolutionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="reporterStatusMessage">
                New reporter-visible update
              </label>

              <textarea
                id="reporterStatusMessage"
                className={classes.textarea}
                value={reporterStatusMessage}
                onChange={(event) =>
                  setReporterStatusMessage(event.target.value)
                }
                placeholder="Optional. This message is visible to the user who submitted the report."
                maxLength={1000}
              />

              <div className={classes.hint}>
                {reporterStatusMessageTrimmed.length}/1000 characters.
              </div>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="adminNotes">
                New internal admin note
              </label>

              <textarea
                id="adminNotes"
                className={classes.textarea}
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                placeholder="Optional. This note is logged in the admin update history."
                maxLength={2000}
              />

              <div className={classes.hint}>
                {adminNotesTrimmed.length}/2000 characters.
              </div>
            </div>

            <div className={classes.row}>
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={() => void handleSaveStatus()}
                disabled={!canSave}
              >
                {updateStatusMutation.isPending
                  ? "Saving…"
                  : "Save report update"}
              </button>

              {conversation?.listing_request_id && (
                <Link
                  className={classes.btnOutline}
                  to={`/admin/requests/${conversation.listing_request_id}`}
                >
                  Open request
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Admin update history</h2>

            {updates.length === 0 ? (
              <p className={classes.text}>
                No admin updates have been logged yet.
              </p>
            ) : (
              <div className={classes.stack}>
                {updates.map((update) => (
                  <div key={update.id} className={classes.updateCard}>
                    <div className="space-y-2">
                      <div>
                        <strong>
                          {profileText(
                            profilesByUserId[update.admin_user_id] ?? null,
                            update.admin_user_id
                          )}
                        </strong>{" "}
                        · {dateText(update.created_at)}
                      </div>

                      <div>
                        Status: {getModerationReportStatusLabel(update.previous_status)} →{" "}
                        {getModerationReportStatusLabel(update.new_status)}
                      </div>

                      <div>
                        Resolution:{" "}
                        {getModerationReportResolutionLabel(
                          update.previous_resolution_code
                        )}{" "}
                        →{" "}
                        {getModerationReportResolutionLabel(update.new_resolution_code)}
                      </div>

                      {update.reporter_status_message && (
                        <div>
                          <strong>Reporter-visible update:</strong>{" "}
                          {update.reporter_status_message}
                        </div>
                      )}

                      {update.admin_notes && (
                        <div>
                          <strong>Internal note:</strong> {update.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModerationReportDetails;