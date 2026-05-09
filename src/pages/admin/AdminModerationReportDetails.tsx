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
import {
  useAdminLockConversation,
  useAdminReopenConversation,
} from "../../hooks/admin/useAdminConversationModerationActions";
import { useAdminModerationReport } from "../../hooks/admin/useAdminModerationReport";
import { useUpdateModerationReportStatus } from "../../hooks/admin/useUpdateModerationReportStatus";
import { useAdminHideListing, useAdminRestoreListing } from '../../hooks/admin/useAdminListingModerationActions';
import { useAdminClearProfileReviewFlag, useAdminMarkProfileUnderReview } from '../../hooks/admin/useAdminProfileModerationActions';

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
  messageBubbleSystem: "border-zinc-200 bg-zinc-50 text-center shadow-none",
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
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-600 bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.24)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(220,38,38,0.32)] disabled:cursor-not-allowed disabled:opacity-60",

  actionCard: "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3",
  actionTitle: "text-sm font-extrabold text-amber-950",
  actionText: "text-sm leading-6 text-amber-900",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  successCard:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",
  updateCard:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800",
  actionTextarea:
    "min-h-[88px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
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
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

const listingModerationActionText = (actionType: string) =>
  actionType === "admin_restored" ? "Restored by admin" : "Hidden by admin";

const profileModerationActionText = (actionType: string) =>
  actionType === "review_cleared"
    ? "Review flag cleared"
    : "Marked under review";

const AdminModerationReportDetails = () => {
  const { id } = useParams();

  const { data, isLoading, error } = useAdminModerationReport(id ?? null);
  const updateStatusMutation = useUpdateModerationReportStatus();
  const lockConversationMutation = useAdminLockConversation();
  const reopenConversationMutation = useAdminReopenConversation();
  const hideListingMutation = useAdminHideListing();
  const restoreListingMutation = useAdminRestoreListing();
  const markProfileUnderReviewMutation = useAdminMarkProfileUnderReview();
  const clearProfileReviewFlagMutation = useAdminClearProfileReviewFlag();

  const report = data?.report ?? null;
  const conversation = data?.conversation ?? null;
  const messages = data?.messages ?? [];
  const listing = data?.listing ?? null;
  const listingModerationActions = data?.listingModerationActions ?? [];
  const reporter = data?.reporter ?? null;
  const reportedUser = data?.reportedUser ?? null;
  const profilesByUserId = data?.profilesByUserId ?? {};
  const updates = data?.updates ?? [];
  const profileModerationState = data?.profileModerationState ?? null;
  const profileModerationActions = data?.profileModerationActions ?? [];


  const [status, setStatus] = useState<ModerationReportStatus>("submitted");
  const [resolutionCode, setResolutionCode] =
    useState<ModerationReportResolutionCode | "">("");
  const [reporterStatusMessage, setReporterStatusMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [conversationActionMessage, setConversationActionMessage] = useState<
    string | null
  >(null);
  const [conversationActionError, setConversationActionError] = useState<
    string | null
  >(null);
  const [listingActionMessage, setListingActionMessage] = useState<string | null>(
    null
  );
  const [listingActionError, setListingActionError] = useState<string | null>(
    null
  );
  const [profileActionMessage, setProfileActionMessage] = useState<string | null>(
    null
  );
  const [profileActionError, setProfileActionError] = useState<string | null>(
    null
  );
  const [moderationActionNote, setModerationActionNote] = useState("");

  useEffect(() => {
    if (!report) return;

    setStatus(report.status);
    setResolutionCode(report.resolution_code ?? "");
    setReporterStatusMessage("");
    setAdminNotes("");
    setSavedMessage(null);
    setConversationActionMessage(null);
    setConversationActionError(null);
    setListingActionMessage(null);
    setListingActionError(null);
    setProfileActionMessage(null);
    setProfileActionError(null);
    setModerationActionNote("");
  }, [report]);

  const reporterStatusMessageTrimmed = reporterStatusMessage.trim();
  const adminNotesTrimmed = adminNotes.trim();

  const hasStatusChanged = report ? status !== report.status : false;

  const hasResolutionChanged = report
    ? resolutionCode !== (report.resolution_code ?? "")
    : false;

  const hasReporterUpdate = reporterStatusMessageTrimmed.length > 0;
  const hasAdminNote = adminNotesTrimmed.length > 0;
  const moderationActionNoteTrimmed = moderationActionNote.trim();

  const moderationActionNotePayload = moderationActionNoteTrimmed
    ? { adminNote: moderationActionNoteTrimmed }
    : {};

  const hasValidModerationActionNote = moderationActionNoteTrimmed.length <= 1000;

  const hasPendingUpdate =
    hasStatusChanged || hasResolutionChanged || hasReporterUpdate || hasAdminNote;

  const canSave =
    Boolean(report) &&
    hasPendingUpdate &&
    reporterStatusMessageTrimmed.length <= 1000 &&
    adminNotesTrimmed.length <= 2000 &&
    !updateStatusMutation.isPending;

  const conversationActionBusy =
    lockConversationMutation.isPending || reopenConversationMutation.isPending;

  const conversationStatus = conversation?.status ?? null;
  const canModerateConversation = Boolean(report?.id && conversation?.id);
  const isConversationOpen = conversationStatus === "open";
  const isConversationAdminLocked = conversationStatus === "admin_locked";

  const profileTargetUserId = report?.profile_user_id ?? null;
  const profileTargetUser = profileTargetUserId
    ? profilesByUserId[profileTargetUserId] ?? reportedUser
    : null;
  const hasProfileTarget = Boolean(profileTargetUserId);

  const listingActionBusy =
    hideListingMutation.isPending || restoreListingMutation.isPending;

  const canModerateListing = Boolean(report?.id && listing?.id);
  const isListingPublished = listing?.status === "published";
  const isListingVisible = Boolean(listing?.is_active);
  const canRestoreListing = isListingPublished && !isListingVisible;

  const profileActionBusy =
    markProfileUnderReviewMutation.isPending ||
    clearProfileReviewFlagMutation.isPending;

  const canModerateProfile = Boolean(report?.id && profileTargetUserId);
  const isProfileUnderReview = Boolean(profileModerationState?.is_under_review);

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

  const handleLockConversation = async () => {
    if (!report?.id || !conversation?.id) return;

    setConversationActionMessage(null);
    setConversationActionError(null);

    try {
      await lockConversationMutation.mutateAsync({
        conversationId: conversation.id,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setModerationActionNote("");

      setConversationActionMessage("Conversation locked by admin.");
    } catch (error) {
      setConversationActionError(
        error instanceof Error
          ? error.message
          : "Conversation could not be locked right now."
      );
    }
  };

  const handleReopenConversation = async () => {
    if (!report?.id || !conversation?.id) return;

    setConversationActionMessage(null);
    setConversationActionError(null);

    try {
      await reopenConversationMutation.mutateAsync({
        conversationId: conversation.id,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setModerationActionNote("");
      setConversationActionMessage("Admin lock removed. Conversation reopened.");
    } catch (error) {
      setConversationActionError(
        error instanceof Error
          ? error.message
          : "Conversation could not be reopened right now."
      );
    }
  };

  const handleHideListing = async () => {
    if (!report?.id || !listing?.id) return;

    setListingActionMessage(null);
    setListingActionError(null);

    try {
      await hideListingMutation.mutateAsync({
        listingId: listing.id,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setListingActionMessage("Listing hidden from public visibility.");
      setModerationActionNote("");
    } catch (error) {
      setListingActionError(
        error instanceof Error
          ? error.message
          : "Listing could not be hidden right now."
      );
    }
  };

  const handleRestoreListing = async () => {
    if (!report?.id || !listing?.id) return;

    setListingActionMessage(null);
    setListingActionError(null);

    try {
      await restoreListingMutation.mutateAsync({
        listingId: listing.id,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setListingActionMessage("Listing restored to public visibility.");
      setModerationActionNote("");
    } catch (error) {
      setListingActionError(
        error instanceof Error
          ? error.message
          : "Listing could not be restored right now."
      );
    }
  };

  const handleMarkProfileUnderReview = async () => {
    if (!report?.id || !profileTargetUserId) return;

    setProfileActionMessage(null);
    setProfileActionError(null);

    try {
      await markProfileUnderReviewMutation.mutateAsync({
        profileUserId: profileTargetUserId,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setProfileActionMessage("Profile marked under review.");
      setModerationActionNote("");
    } catch (error) {
      setProfileActionError(
        error instanceof Error
          ? error.message
          : "Profile could not be marked under review right now."
      );
    }
  };

  const handleClearProfileReviewFlag = async () => {
    if (!report?.id || !profileTargetUserId) return;

    setProfileActionMessage(null);
    setProfileActionError(null);

    try {
      await clearProfileReviewFlagMutation.mutateAsync({
        profileUserId: profileTargetUserId,
        moderationReportId: report.id,
        ...moderationActionNotePayload,
      });

      setProfileActionMessage("Profile review flag cleared.");
      setModerationActionNote("");
    } catch (error) {
      setProfileActionError(
        error instanceof Error
          ? error.message
          : "Profile review flag could not be cleared right now."
      );
    }
  };

  const renderModerationActionNoteField = () => (
    <div className={classes.field}>
      <label className={classes.label} htmlFor="moderationActionNote">
        Internal moderation action note
      </label>

      <textarea
        id="moderationActionNote"
        className={classes.actionTextarea}
        value={moderationActionNote}
        onChange={(event) => setModerationActionNote(event.target.value)}
        placeholder="Optional. This note is stored with the moderation action history."
        maxLength={1000}
      />

      <div className={classes.hint}>
        {moderationActionNoteTrimmed.length}/1000 characters.
      </div>
    </div>
  );

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
                  {report.reason_details ||
                    "No additional report details provided."}
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

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Listing visibility</div>
                    <div className={classes.metaValue}>
                      {listing.is_active ? "Visible" : "Hidden"}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Listing owner</div>
                    <div className={classes.metaValue}>
                      {profileText(reportedUser, listing.user_id)}
                    </div>
                  </div>
                </div>
              )}

              {hasProfileTarget && (
                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Profile user</div>
                    <div className={classes.metaValue}>
                      {profileText(profileTargetUser, profileTargetUserId ?? "Unknown profile")}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Handle</div>
                    <div className={classes.metaValue}>
                      {profileTargetUser?.handle
                        ? `@${profileTargetUser.handle}`
                        : "No handle set"}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Display name</div>
                    <div className={classes.metaValue}>
                      {profileTargetUser?.display_name ?? "No display name set"}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Profile user ID</div>
                    <div className={classes.metaValue}>
                      {profileTargetUserId ?? "Unknown profile"}
                    </div>
                  </div>
                </div>
              )}

              {!conversation && !listing && !hasProfileTarget && (
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

        <div className={classes.stack}>
          {canModerateConversation && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>
                  Conversation moderation
                </h2>

                <div className={classes.actionCard}>
                  <div className={classes.actionTitle}>
                    Admin conversation lock
                  </div>

                  <p className={classes.actionText}>
                    Current status:{" "}
                    <span className="font-bold">{conversationStatus ?? "Unknown"}</span>
                  </p>

                  <p className={classes.actionText}>
                    Locking prevents the Client and Creator from sending more
                    messages while admins review this report.
                  </p>
                </div>

                {conversationActionMessage && (
                  <div className={classes.successCard}>
                    {conversationActionMessage}
                  </div>
                )}

                {conversationActionError && (
                  <div className={classes.errorCard}>
                    {conversationActionError}
                  </div>
                )}

                {renderModerationActionNoteField()}

                <div className={classes.row}>
                  {!isConversationAdminLocked && (
                    <button
                      className={classes.btnDanger}
                      type="button"
                      disabled={
                        conversationActionBusy || !isConversationOpen || !hasValidModerationActionNote
                      }
                      onClick={() => void handleLockConversation()}
                    >
                      {lockConversationMutation.isPending
                        ? "Locking…"
                        : "Lock conversation"}
                    </button>
                  )}

                  {isConversationAdminLocked && (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      disabled={conversationActionBusy || !hasValidModerationActionNote}
                      onClick={() => void handleReopenConversation()}
                    >
                      {reopenConversationMutation.isPending
                        ? "Reopening…"
                        : "Reopen conversation"}
                    </button>
                  )}
                </div>

                {!isConversationOpen && !isConversationAdminLocked && (
                  <p className={classes.hint}>
                    Only open conversations can be admin locked. Already closed
                    conversations remain available for review.
                  </p>
                )}
              </div>
            </div>
          )}

          {canModerateListing && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>Listing moderation</h2>

                <div className={classes.actionCard}>
                  <div className={classes.actionTitle}>Admin listing visibility</div>

                  <p className={classes.actionText}>
                    Listing: <span className="font-bold">{listing?.title}</span>
                  </p>

                  <p className={classes.actionText}>
                    Status:{" "}
                    <span className="font-bold">{listing?.status ?? "Unknown"}</span>
                  </p>

                  <p className={classes.actionText}>
                    Visibility:{" "}
                    <span className="font-bold">
                      {isListingVisible ? "Visible" : "Hidden"}
                    </span>
                  </p>

                  <p className={classes.actionText}>
                    Hiding removes the listing from public marketplace surfaces without
                    deleting it or changing its draft/published status.
                  </p>
                </div>

                {listingActionMessage && (
                  <div className={classes.successCard}>{listingActionMessage}</div>
                )}

                {listingActionError && (
                  <div className={classes.errorCard}>{listingActionError}</div>
                )}

                {renderModerationActionNoteField()}

                <div className={classes.row}>
                  {isListingVisible && (
                    <button
                      className={classes.btnDanger}
                      type="button"
                      disabled={listingActionBusy || !hasValidModerationActionNote}
                      onClick={() => void handleHideListing()}
                    >
                      {hideListingMutation.isPending ? "Hiding…" : "Hide listing"}
                    </button>
                  )}

                  {!isListingVisible && (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      disabled={listingActionBusy || !canRestoreListing || !hasValidModerationActionNote}
                      onClick={() => void handleRestoreListing()}
                    >
                      {restoreListingMutation.isPending
                        ? "Restoring…"
                        : "Restore listing"}
                    </button>
                  )}
                </div>

                {!isListingVisible && !isListingPublished && (
                  <p className={classes.hint}>
                    Only published listings can be restored to public visibility. Draft
                    listings should stay hidden.
                  </p>
                )}
              </div>
            </div>
          )}

          {canModerateListing && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>Listing moderation history</h2>

                {listingModerationActions.length === 0 ? (
                  <p className={classes.text}>
                    No listing moderation actions have been logged yet.
                  </p>
                ) : (
                  <div className={classes.stack}>
                    {listingModerationActions.map((action) => (
                      <div key={action.id} className={classes.updateCard}>
                        <div className="space-y-2">
                          <div>
                            <strong>{listingModerationActionText(action.action_type)}</strong>{" "}
                            · {dateText(action.created_at)}
                          </div>

                          <div>
                            Admin:{" "}
                            {profileText(
                              profilesByUserId[action.admin_user_id] ?? null,
                              action.admin_user_id
                            )}
                          </div>

                          <div>
                            Visibility:{" "}
                            {action.previous_is_active ? "Visible" : "Hidden"} →{" "}
                            {action.new_is_active ? "Visible" : "Hidden"}
                          </div>

                          <div>
                            Status: {action.previous_status} → {action.new_status}
                          </div>

                          {action.moderation_report_id && (
                            <div>
                              Report:{" "}
                              {action.moderation_report_id === report.id
                                ? "This report"
                                : action.moderation_report_id}
                            </div>
                          )}

                          {action.admin_note && (
                            <div>
                              <strong>Internal note:</strong> {action.admin_note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {canModerateProfile && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>Profile moderation</h2>

                <div className={classes.actionCard}>
                  <div className={classes.actionTitle}>Admin profile review</div>

                  <p className={classes.actionText}>
                    Profile:{" "}
                    <span className="font-bold">
                      {profileText(profileTargetUser, profileTargetUserId ?? "Unknown profile")}
                    </span>
                  </p>

                  <p className={classes.actionText}>
                    Review state:{" "}
                    <span className="font-bold">
                      {isProfileUnderReview ? "Under review" : "Not under review"}
                    </span>
                  </p>

                  <p className={classes.actionText}>
                    This is an internal admin flag only. It does not hide the profile,
                    suspend the user, or notify either party.
                  </p>
                </div>

                {profileActionMessage && (
                  <div className={classes.successCard}>{profileActionMessage}</div>
                )}

                {profileActionError && (
                  <div className={classes.errorCard}>{profileActionError}</div>
                )}

                {renderModerationActionNoteField()}

                <div className={classes.row}>
                  {!isProfileUnderReview && (
                    <button
                      className={classes.btnDanger}
                      type="button"
                      disabled={profileActionBusy || !hasValidModerationActionNote}
                      onClick={() => void handleMarkProfileUnderReview()}
                    >
                      {markProfileUnderReviewMutation.isPending
                        ? "Marking…"
                        : "Mark under review"}
                    </button>
                  )}

                  {isProfileUnderReview && (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      disabled={profileActionBusy || !hasValidModerationActionNote}
                      onClick={() => void handleClearProfileReviewFlag()}
                    >
                      {clearProfileReviewFlagMutation.isPending
                        ? "Clearing…"
                        : "Clear review flag"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {canModerateProfile && (
            <div className={classes.card}>
              <div className={classes.section}>
                <h2 className={classes.sectionTitle}>Profile moderation history</h2>

                {profileModerationActions.length === 0 ? (
                  <p className={classes.text}>
                    No profile moderation actions have been logged yet.
                  </p>
                ) : (
                  <div className={classes.stack}>
                    {profileModerationActions.map((action) => (
                      <div key={action.id} className={classes.updateCard}>
                        <div className="space-y-2">
                          <div>
                            <strong>{profileModerationActionText(action.action_type)}</strong>{" "}
                            · {dateText(action.created_at)}
                          </div>

                          <div>
                            Admin:{" "}
                            {profileText(
                              profilesByUserId[action.admin_user_id] ?? null,
                              action.admin_user_id
                            )}
                          </div>

                          <div>
                            Review state:{" "}
                            {action.previous_is_under_review
                              ? "Under review"
                              : "Not under review"}{" "}
                            →{" "}
                            {action.new_is_under_review
                              ? "Under review"
                              : "Not under review"}
                          </div>

                          {action.moderation_report_id && (
                            <div>
                              Report:{" "}
                              {action.moderation_report_id === report.id
                                ? "This report"
                                : action.moderation_report_id}
                            </div>
                          )}

                          {action.admin_note && (
                            <div>
                              <strong>Internal note:</strong> {action.admin_note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
                          Status:{" "}
                          {getModerationReportStatusLabel(
                            update.previous_status
                          )}{" "}
                          → {getModerationReportStatusLabel(update.new_status)}
                        </div>

                        <div>
                          Resolution:{" "}
                          {getModerationReportResolutionLabel(
                            update.previous_resolution_code
                          )}{" "}
                          →{" "}
                          {getModerationReportResolutionLabel(
                            update.new_resolution_code
                          )}
                        </div>

                        {update.reporter_status_message && (
                          <div>
                            <strong>Reporter-visible update:</strong>{" "}
                            {update.reporter_status_message}
                          </div>
                        )}

                        {update.admin_notes && (
                          <div>
                            <strong>Internal note:</strong>{" "}
                            {update.admin_notes}
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
    </div>
  );
};

export default AdminModerationReportDetails;