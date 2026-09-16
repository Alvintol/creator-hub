import { useEffect, useRef, useState, } from "react";
import { Link, useParams } from "react-router-dom";
import {
  canSendConversationMessage,
  ConversationCloseReasonCode,
  conversationCloseReasonOptions,
  getBuyerImageUploadStatusLabel,
  getConversationCloseReasonLabel,
  getConversationInitiationReasonLabel,
  isConversationReadOnly,
} from "../../domain/conversations/conversations";
import { useConversationDetails } from "../../hooks/conversations/useConversationDetails";
import { useConversationMessages } from "../../hooks/conversations/useConversationMessages";
import { useConversationParticipants } from "../../hooks/conversations/useConversationParticipants";
import { useMarkConversationRead } from "../../hooks/conversations/useMarkConversationRead";
import { conversationModerationReportReasonOptions, getModerationReportStatusLabel, getModerationReportStatusSummary, ModerationReportReasonCode } from '../../domain/moderation/moderationReports';
import { useMyModerationReports } from '../../hooks/moderation/useMyModerationReports';
import { useSubmitModerationReport } from '../../hooks/moderation/useSubmitModerationReport';
import { useApproveBuyerImageUpload, useRequestBuyerImageUpload, useRevokeBuyerImageUpload } from '../../hooks/conversations/useConversationImagePermissions';
import { useCloseConversation } from '../../hooks/conversations/useCloseConversation';
import { Collapse, FadeIn, useStaggerIn } from "../../lib/motion";

const fieldControl =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[rgb(var(--brand)/0.45)] focus:ring-4 focus:ring-[rgb(var(--brand)/0.12)] disabled:cursor-not-allowed disabled:opacity-60";

const ghostButton =
  "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";

const classes = {
  card: "card overflow-hidden",
  loadingCard: "card p-6",
  header:
    "flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6",
  headerText: "space-y-0.5",
  title: "font-display text-lg font-bold tracking-tight text-zinc-900",
  sub: "pageSub",
  headerActions: "flex flex-wrap items-center gap-2",
  body: "space-y-4 p-5 sm:p-6",

  notice: "rounded-xl border px-4 py-3 text-sm",
  statusBox: "border-zinc-200 bg-zinc-50 text-zinc-700",
  warningBox: "border-amber-200 bg-amber-50 text-amber-800",
  errorBox: "border-red-200 bg-red-50 text-red-700",
  successBox: "border-emerald-200 bg-emerald-50 text-emerald-800",

  closedStatusTitle: "font-display text-sm font-bold text-zinc-900",
  closedStatusList: "mt-2 grid gap-1 text-sm text-zinc-600",
  closedStatusLabel: "font-semibold text-zinc-800",

  thread:
    "max-h-[34rem] min-h-[12rem] space-y-5 overflow-y-auto rounded-2xl bg-zinc-50/80 p-4 ring-1 ring-inset ring-zinc-100 sm:p-5",
  loadingText: "text-sm text-zinc-500",
  empty:
    "flex min-h-[12rem] items-center justify-center rounded-2xl bg-zinc-50/80 px-4 text-center text-sm text-zinc-500 ring-1 ring-inset ring-zinc-100",
  adminNote:
    "rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-center text-sm text-zinc-500",

  messageRow: "group flex flex-col",
  messageRowOwn: "items-end",
  messageRowOther: "items-start",
  messageRowSystem: "items-center",

  messageMeta: "mb-1 flex flex-wrap items-center gap-1.5 px-1 text-xs text-zinc-500",
  messageName: "font-semibold text-zinc-800",
  messageRole:
    "rounded-full bg-zinc-200/70 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-zinc-600",

  messageBubble:
    "max-w-[min(100%,36rem)] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6",
  messageBubbleOwn:
    "rounded-br-md bg-gradient-to-b from-zinc-800 to-zinc-900 text-white shadow-[0_6px_16px_-8px_rgb(17_17_20/0.45)]",
  messageBubbleOther:
    "rounded-bl-md border border-zinc-200 bg-white text-zinc-800 shadow-sm",
  systemMessage:
    "max-w-[min(100%,32rem)] rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-center text-xs text-zinc-600",
  systemMeta: "mb-1 text-[11px] text-zinc-400",

  readReceipt: "mt-1 px-1 text-[11px] font-medium text-zinc-400",
  messageActions: "mt-1 px-1",
  messageActionsHidden:
    "mt-1 px-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus-within:opacity-100",
  reportLink:
    "text-[11px] font-medium text-zinc-400 underline-offset-2 transition hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:hover:text-zinc-400",

  reportStatusBox:
    "rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900",
  messageReportStatusBox:
    "mt-2 max-w-[min(100%,36rem)] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900",
  reportStatusTitle: "font-semibold",
  reportStatusText: "mt-0.5 text-rose-800/90",

  panel: "space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5",
  dangerPanel: "space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-4 sm:p-5",
  panelTitle: "font-display text-sm font-bold text-zinc-900",
  field: "space-y-1.5",
  label: "block text-sm font-semibold text-zinc-800",
  hint: "formHint",
  select: fieldControl,
  textarea: `${fieldControl} min-h-[100px]`,
  row: "flex flex-wrap items-center gap-2",

  composer:
    "rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-[rgb(var(--brand)/0.45)] focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12)]",
  composerTextarea:
    "block min-h-[96px] w-full resize-y rounded-t-2xl border-0 bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60",
  composerFooter:
    "flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5",
  composerTools: "flex min-w-0 flex-wrap items-center gap-2",
  composerSend: "flex items-center gap-3",
  counter: "text-xs tabular-nums text-zinc-400",
  imageStatus:
    "inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600",
  imageStatusLabel: "font-semibold text-zinc-800",
  imageNote: "px-1 text-xs text-zinc-500",

  btnPrimary: "btnPrimary",
  btnSend: "btnPrimary px-4 py-2",
  btnOutline: "btnOutline",
  btnDanger:
    "btnDanger",
  headerButton: `${ghostButton} text-zinc-700`,
  headerDangerButton: `${ghostButton} text-red-600 hover:border-red-200 hover:bg-red-50`,
  chatUtilityButton: `${ghostButton} py-1 text-zinc-700`,
} as const;

const notice = (tone: string) => `${classes.notice} ${tone}`;

const pageClasses = {
  page: "space-y-5",
  backLink:
    "inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900",
  h1: "font-display text-2xl font-bold tracking-tight text-zinc-900",
  participants: "text-sm text-zinc-500",
} as const;

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
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId);

const MessageDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [body, setBody] = useState("");
  const [showImageRequestForm, setShowImageRequestForm] = useState(false);
  const [imageRequestNote, setImageRequestNote] = useState("");
  const [reportTarget, setReportTarget] = useState<{
    type: "conversation" | "message";
    messageId: string | null;
  } | null>(null);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReasonCode, setCloseReasonCode] =
    useState<ConversationCloseReasonCode | "">("");
  const [closeReasonDetails, setCloseReasonDetails] = useState("");

  const [reportReasonCode, setReportReasonCode] =
    useState<ModerationReportReasonCode | "">("");

  const [reportReasonDetails, setReportReasonDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportPanelType, setReportPanelType] =
    useState<"conversation" | "message">("conversation");
  const threadRef = useRef<HTMLDivElement>(null);

  const requestBuyerImageUploadMutation = useRequestBuyerImageUpload();
  const approveBuyerImageUploadMutation = useApproveBuyerImageUpload();
  const revokeBuyerImageUploadMutation = useRevokeBuyerImageUpload();
  const {
    data,
    isLoading: isConversationLoading,
    error: conversationError,
  } = useConversationDetails(id ?? null);

  const conversation = data?.conversation ?? null;
  const buyer = data?.buyer ?? null;
  const creator = data?.creator ?? null;
  const listing = data?.listing ?? null;

  const {
    messages,
    isLoading: areMessagesLoading,
    error: messagesError,
    currentUserId,
    sendMessageMutation,
  } = useConversationMessages(conversation?.id ?? null);
  const reportConversationMutation = useSubmitModerationReport();
  const closeConversationMutation = useCloseConversation();

  const { data: myReports = [] } = useMyModerationReports();

  const { data: participants = [] } = useConversationParticipants(
    conversation?.id ?? null
  );

  const markConversationReadMutation = useMarkConversationRead();
  const lastMarkedReadMessageAtRef = useRef<string | null>(null);

  const trimmedBody = body.trim();

  const readOnly =
    !conversation || isConversationReadOnly(conversation.status);

  const viewerRole =
    conversation && currentUserId === conversation.buyer_user_id
      ? "buyer"
      : conversation && currentUserId === conversation.creator_user_id
        ? "creator"
        : null;

  const imageRequestNoteTrimmed = imageRequestNote.trim();

  const imageRequestNoteError =
    imageRequestNoteTrimmed.length > 1000
      ? "Request note must be 1000 characters or less."
      : null;

  const isImageActionPending =
    requestBuyerImageUploadMutation.isPending ||
    approveBuyerImageUploadMutation.isPending ||
    revokeBuyerImageUploadMutation.isPending;

  const buyerImageUploadStatus =
    conversation?.buyer_image_upload_status ?? "blocked";

  const canRequestImageUpload =
    Boolean(conversation) &&
    viewerRole === "buyer" &&
    !readOnly &&
    (buyerImageUploadStatus === "blocked" ||
      buyerImageUploadStatus === "revoked");

  const canApproveImageUpload =
    Boolean(conversation) &&
    viewerRole === "creator" &&
    !readOnly &&
    buyerImageUploadStatus !== "approved";

  const canRevokeImageUpload =
    Boolean(conversation) &&
    viewerRole === "creator" &&
    !readOnly &&
    buyerImageUploadStatus === "approved";

  const approveImageUploadButtonText =
    buyerImageUploadStatus === "requested"
      ? "Allow client images"
      : "Enable client images";

  const otherParticipantUserId =
    conversation && currentUserId === conversation.buyer_user_id
      ? conversation.creator_user_id
      : conversation && currentUserId === conversation.creator_user_id
        ? conversation.buyer_user_id
        : null;

  const otherParticipantLabel =
    conversation && currentUserId === conversation.buyer_user_id
      ? "Creator"
      : conversation && currentUserId === conversation.creator_user_id
        ? "Client"
        : null;

  const otherParticipantLastReadAt =
    otherParticipantUserId
      ? participants.find(
        (participant) => participant.user_id === otherParticipantUserId
      )?.last_read_at ?? null
      : null;

  const hasOtherParticipantReadMessage = (messageCreatedAt: string): boolean => {
    if (!otherParticipantLastReadAt) return false;

    const readAtTime = new Date(otherParticipantLastReadAt).getTime();
    const messageTime = new Date(messageCreatedAt).getTime();

    if (Number.isNaN(readAtTime) || Number.isNaN(messageTime)) return false;

    return readAtTime >= messageTime;
  };

  const latestReadOwnMessageId =
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.message_type !== "system" &&
          message.sender_user_id === currentUserId &&
          hasOtherParticipantReadMessage(message.created_at)
      )?.id ?? null;

  const reportReasonDetailsTrimmed = reportReasonDetails.trim();
  const isOtherReportReason = reportReasonCode === "other";

  const reportReasonDetailsError =
    isOtherReportReason && reportReasonDetailsTrimmed.length < 10
      ? "Please provide a reason for the report."
      : reportReasonDetailsTrimmed.length > 1000
        ? "Additional details must be 1000 characters or less."
        : null;

  const canSubmitReport =
    Boolean(conversation) &&
    Boolean(reportTarget) &&
    Boolean(reportReasonCode) &&
    !reportReasonDetailsError &&
    !reportConversationMutation.isPending;

  const closeReasonDetailsTrimmed = closeReasonDetails.trim();
  const isOtherCloseReason = closeReasonCode === "other";

  const closeReasonDetailsError =
    isOtherCloseReason && closeReasonDetailsTrimmed.length < 10
      ? "Please give more detail."
      : closeReasonDetailsTrimmed.length > 1000
        ? "Additional details must be 1000 characters or less."
        : null;

  const isConversationParticipant =
    Boolean(conversation) &&
    Boolean(currentUserId) &&
    (currentUserId === conversation?.buyer_user_id ||
      currentUserId === conversation?.creator_user_id);

  const canCloseConversation =
    Boolean(conversation) && conversation?.status === "open";

  const canConfirmCloseConversation =
    Boolean(closeReasonCode) &&
    !closeReasonDetailsError &&
    !closeConversationMutation.isPending;

  const conversationReport =
    myReports.find(
      (report) =>
        report.target_type === "conversation" &&
        report.conversation_id === conversation?.id
    ) ?? null;

  const getMessageReport = (messageId: string) =>
    myReports.find(
      (report) =>
        report.target_type === "conversation_message" &&
        report.message_id === messageId
    ) ?? null;

  const hasReportedConversation = Boolean(conversationReport);

  const hasReportedMessage = (messageId: string): boolean =>
    Boolean(getMessageReport(messageId));

  const getReportedConversationButtonText = () =>
    conversationReport
      ? `Conversation reported · ${getModerationReportStatusLabel(
        conversationReport.status
      )}`
      : "Report conversation";

  const getReportedMessageButtonText = (messageId: string) => {
    const report = getMessageReport(messageId);

    return report
      ? `Message reported · ${getModerationReportStatusLabel(report.status)}`
      : "Report message";
  };

  const openConversationReport = () => {
    if (hasReportedConversation) return;

    setReportSubmitted(false);
    setReportPanelType("conversation");
    setReportTarget({
      type: "conversation",
      messageId: null,
    });
    setReportReasonCode("");
    setReportReasonDetails("");
  };

  const openMessageReport = (messageId: string) => {
    if (hasReportedMessage(messageId)) return;

    setReportSubmitted(false);
    setReportPanelType("message");
    setReportTarget({
      type: "message",
      messageId,
    });
    setReportReasonCode("");
    setReportReasonDetails("");
  };

  const closeReportForm = () => {
    setReportTarget(null);
    setReportReasonCode("");
    setReportReasonDetails("");
  };

  const handleCloseConversation = async () => {
    if (!conversation || !closeReasonCode || closeReasonDetailsError) return;

    try {
      await closeConversationMutation.mutateAsync({
        conversationId: conversation.id,
        reasonCode: closeReasonCode,
        reasonDetails: closeReasonDetailsTrimmed,
      });

      setShowCloseForm(false);
      setCloseReasonCode("");
      setCloseReasonDetails("");
    } catch {
      // Error is surfaced below
    }
  };

  const handleRequestImageUpload = async () => {
    if (!conversation || imageRequestNoteError) return;

    try {
      await requestBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
        requestNote: imageRequestNoteTrimmed,
      });

      setShowImageRequestForm(false);
      setImageRequestNote("");
    } catch {
      // Error is surfaced below
    }
  };

  const handleApproveImageUpload = async () => {
    if (!conversation) return;

    try {
      await approveBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleRevokeImageUpload = async () => {
    if (!conversation) return;

    try {
      await revokeBuyerImageUploadMutation.mutateAsync({
        conversationId: conversation.id,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleSubmitReport = async () => {
    if (
      !conversation ||
      !reportTarget ||
      !reportReasonCode ||
      reportReasonDetailsError
    ) {
      return;
    }

    try {
      await reportConversationMutation.mutateAsync({
        targetType:
          reportTarget.type === "message"
            ? "conversation_message"
            : "conversation",
        conversationId: conversation.id,
        messageId: reportTarget.messageId,
        reasonCode: reportReasonCode,
        reasonDetails: reportReasonDetailsTrimmed,
      });

      setReportSubmitted(true);
      closeReportForm();
    } catch {
      // Error is surfaced below
    }
  };

  useEffect(() => {
    if (!conversation || !currentUserId) return;

    const latestMessageAt = conversation.last_message_at;
    const latestSenderUserId = conversation.last_message_sender_user_id;

    if (!latestMessageAt || !latestSenderUserId) return;
    if (latestSenderUserId === currentUserId) return;
    if (lastMarkedReadMessageAtRef.current === latestMessageAt) return;
    if (markConversationReadMutation.isPending) return;

    lastMarkedReadMessageAtRef.current = latestMessageAt;

    void markConversationReadMutation.mutateAsync({
      conversationId: conversation.id,
    });
  }, [conversation, currentUserId, markConversationReadMutation]);

  const canSubmit =
    Boolean(conversation) &&
    !readOnly &&
    canSendConversationMessage(conversation.status) &&
    trimmedBody.length >= 1 &&
    trimmedBody.length <= 2000 &&
    !sendMessageMutation.isPending;

  const senderRoleText = (senderUserId: string) =>
    conversation && senderUserId === conversation.buyer_user_id
      ? "Client"
      : conversation && senderUserId === conversation.creator_user_id
        ? "Creator"
        : "System";

  const senderLabelText = (senderUserId: string) =>
    conversation && senderUserId === conversation.buyer_user_id
      ? profileText(buyer, senderUserId)
      : conversation && senderUserId === conversation.creator_user_id
        ? profileText(creator, senderUserId)
        : "CreatorHub";

  const handleSubmitMessage = async () => {
    if (!canSubmit) return;

    try {
      await sendMessageMutation.mutateAsync(trimmedBody);
      setBody("");
    } catch {
      // Error is surfaced below
    }
  };

  useStaggerIn(threadRef, messages.length, {
    resetKey: conversation?.id ?? null,
    scrollToEnd: true,
  });

  if (isConversationLoading) {
    return (
      <div className={classes.loadingCard}>
        <div className={classes.loadingText}>Loading conversation…</div>
      </div>
    );
  }

  if (conversationError || !conversation) {
    return (
      <div className={`${classes.loadingCard} space-y-3`}>
        <h1 className={pageClasses.h1}>Conversation</h1>
        <div className={notice(classes.errorBox)}>
          Conversation could not be loaded right now.
        </div>
      </div>
    );
  }

  const renderReportStatus = (
    report: NonNullable<typeof conversationReport>,
    title: string,
    className: string
  ) => (
    <div className={className}>
      <div className={classes.reportStatusTitle}>{title}</div>

      <div className={classes.reportStatusText}>
        Status: {getModerationReportStatusLabel(report.status)}
      </div>

      <div className={classes.reportStatusText}>
        {report.reporter_status_message ||
          getModerationReportStatusSummary(report.status)}
      </div>

      {report.reporter_status_updated_at && (
        <div className={classes.reportStatusText}>
          Last update: {dateText(report.reporter_status_updated_at)}
        </div>
      )}
    </div>
  );

  return (
    <div className={pageClasses.page}>
      <Link to="/messages" className={pageClasses.backLink}>
        ← Back to messages
      </Link>

      <div className={classes.card}>
        <div className={classes.header}>
          <div className={classes.headerText}>
            <h1 className={pageClasses.h1}>
              {listing?.title ?? conversation.subject ?? "Conversation"}
            </h1>

            <p className={classes.sub}>
              Topic:{" "}
              {getConversationInitiationReasonLabel(
                conversation.initiation_reason_code
              )}
            </p>

            <p className={pageClasses.participants}>
              Client: {profileText(buyer, conversation.buyer_user_id)} · Creator:{" "}
              {profileText(creator, conversation.creator_user_id)}
            </p>
          </div>

          <div className={classes.headerActions}>
            <button
              className={classes.headerButton}
              type="button"
              onClick={openConversationReport}
              disabled={hasReportedConversation || reportConversationMutation.isPending}
            >
              {getReportedConversationButtonText()}
            </button>

            {canCloseConversation && (
              <button
                className={classes.headerDangerButton}
                type="button"
                onClick={() => setShowCloseForm((current) => !current)}
              >
                {showCloseForm ? "Cancel ending conversation" : "End conversation"}
              </button>
            )}
          </div>
        </div>

        <div className={classes.body}>
          {conversation.status === "closed" && (
            <div className={notice(classes.statusBox)}>
              <div className={classes.closedStatusTitle}>Conversation ended</div>

              <div className={classes.closedStatusList}>
                <div>
                  <span className={classes.closedStatusLabel}>Status:</span> This
                  conversation has been ended and is now read-only for both parties.
                </div>

                <div>
                  <span className={classes.closedStatusLabel}>Reason:</span>{" "}
                  {getConversationCloseReasonLabel(conversation.closed_reason_code)}
                </div>

                <div>
                  <span className={classes.closedStatusLabel}>Additional details:</span>{" "}
                  {conversation.closed_reason_details || "No additional details provided."}
                </div>

                {conversation.closed_at && (
                  <div>
                    <span className={classes.closedStatusLabel}>Ended on:</span>{" "}
                    {dateText(conversation.closed_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {conversation.status === "admin_locked" && (
            <div className={notice(classes.warningBox)}>
              This conversation has been locked by an admin and is read-only.
            </div>
          )}

          <Collapse open={canCloseConversation && showCloseForm}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>End conversation</div>

              <div className={notice(classes.warningBox)}>
                Ending this conversation will make the thread read-only for both
                parties. The message history and reason will remain visible.
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeReason">
                  Reason for ending conversation
                </label>

                <select
                  id="closeReason"
                  className={classes.select}
                  value={closeReasonCode}
                  onChange={(event) =>
                    setCloseReasonCode(
                      event.target.value as ConversationCloseReasonCode | ""
                    )
                  }
                >
                  <option value="">Choose a reason</option>

                  {conversationCloseReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="closeDetails">
                  Additional details{isOtherCloseReason ? " *" : ""}
                </label>

                <textarea
                  id="closeDetails"
                  className={classes.textarea}
                  value={closeReasonDetails}
                  onChange={(event) => setCloseReasonDetails(event.target.value)}
                  placeholder={
                    isOtherCloseReason
                      ? "Required. Explain why this conversation is being ended."
                      : "Optional. Add context for both parties and admins."
                  }
                  maxLength={1000}
                />

                <div className={classes.hint}>
                  {closeReasonDetailsTrimmed.length}/1000 characters.
                  {isOtherCloseReason
                    ? " Mandatory. Please explain why this conversation is being ended."
                    : " Optional, but helpful for both parties and admins."}
                </div>

                {closeReasonDetailsError && (
                  <div className={notice(classes.errorBox)}>{closeReasonDetailsError}</div>
                )}
              </div>

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleCloseConversation()}
                  disabled={!canConfirmCloseConversation}
                >
                  {closeConversationMutation.isPending
                    ? "Ending conversation…"
                    : "Confirm end conversation"}
                </button>
              </div>
            </div>
          </Collapse>

          {closeConversationMutation.error && (
            <FadeIn className={notice(classes.errorBox)}>
              Conversation could not be ended right now.
            </FadeIn>
          )}

          <Collapse open={Boolean(reportTarget)}>
            <div className={classes.dangerPanel}>
              <div className={classes.panelTitle}>
                {reportPanelType === "message"
                  ? "Report message"
                  : "Report conversation"}
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportReason">
                  Reason
                </label>

                <select
                  id="reportReason"
                  className={classes.select}
                  value={reportReasonCode}
                  onChange={(event) =>
                    setReportReasonCode(
                      event.target.value as ModerationReportReasonCode | ""
                    )
                  }
                >
                  <option value="">Choose a reason</option>

                  {conversationModerationReportReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="reportDetails">
                  Additional details{isOtherReportReason ? " *" : ""}
                </label>

                <textarea
                  id="reportDetails"
                  className={classes.textarea}
                  value={reportReasonDetails}
                  onChange={(event) => setReportReasonDetails(event.target.value)}
                  placeholder={
                    isOtherReportReason
                      ? "Required. Explain why this should be reviewed."
                      : "Optional. Add context for the admin reviewing this report."
                  }
                  maxLength={1000}
                />

                <div className={classes.hint}>
                  {reportReasonDetailsTrimmed.length}/1000 characters.
                  {isOtherReportReason
                    ? " Please provide a reason for the report."
                    : " Optional unless you choose Other."}
                </div>

                {reportReasonDetailsError && (
                  <div className={notice(classes.errorBox)}>{reportReasonDetailsError}</div>
                )}
              </div>

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={!canSubmitReport}
                >
                  {reportConversationMutation.isPending
                    ? "Submitting report…"
                    : "Submit report"}
                </button>

                <button
                  className={classes.btnOutline}
                  type="button"
                  onClick={closeReportForm}
                  disabled={reportConversationMutation.isPending}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Collapse>

          {reportSubmitted && (
            <FadeIn className={notice(classes.successBox)}>
              Report submitted. An admin can review it.
            </FadeIn>
          )}

          {reportConversationMutation.error && (
            <FadeIn className={notice(classes.errorBox)}>
              Report could not be submitted right now.
            </FadeIn>
          )}

          {conversationReport &&
            renderReportStatus(
              conversationReport,
              "Conversation report status",
              classes.reportStatusBox
            )}

          {areMessagesLoading ? (
            <div className={classes.empty}>
              <span className={classes.loadingText}>Loading messages…</span>
            </div>
          ) : messagesError ? (
            <div className={notice(classes.errorBox)}>
              Messages could not be loaded right now.
            </div>
          ) : messages.length > 0 ? (
            <div ref={threadRef} className={classes.thread}>
              {messages.map((message) => {
                const isSystemMessage = message.message_type === "system";
                const isOwnMessage = message.sender_user_id === currentUserId;
                const messageReport = getMessageReport(message.id);

                if (isSystemMessage) {
                  return (
                    <div
                      key={message.id}
                      className={`${classes.messageRow} ${classes.messageRowSystem}`}
                    >
                      <div className={classes.systemMeta}>
                        CreatorHub · {dateText(message.created_at)}
                      </div>
                      <div className={classes.systemMessage}>{message.body}</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={`${classes.messageRow} ${isOwnMessage ? classes.messageRowOwn : classes.messageRowOther}`}
                  >
                    <div
                      className={`${classes.messageMeta} ${isOwnMessage ? "justify-end" : ""}`}
                    >
                      <span className={classes.messageName}>
                        {senderLabelText(message.sender_user_id)}
                      </span>

                      <span className={classes.messageRole}>
                        {senderRoleText(message.sender_user_id)}
                      </span>

                      <span aria-hidden="true">·</span>

                      <span>{dateText(message.created_at)}</span>
                    </div>

                    <div
                      className={`${classes.messageBubble} ${isOwnMessage ? classes.messageBubbleOwn : classes.messageBubbleOther}`}
                    >
                      {message.body}
                    </div>

                    {message.id === latestReadOwnMessageId &&
                      otherParticipantLabel &&
                      otherParticipantLastReadAt && (
                        <div className={classes.readReceipt}>
                          Read by {otherParticipantLabel} ·{" "}
                          {dateText(otherParticipantLastReadAt)}
                        </div>
                      )}

                    {!isOwnMessage && (
                      <div
                        className={
                          messageReport
                            ? classes.messageActions
                            : classes.messageActionsHidden
                        }
                      >
                        <button
                          className={classes.reportLink}
                          type="button"
                          onClick={() => openMessageReport(message.id)}
                          disabled={
                            hasReportedMessage(message.id) ||
                            reportConversationMutation.isPending
                          }
                        >
                          {getReportedMessageButtonText(message.id)}
                        </button>
                      </div>
                    )}

                    {messageReport &&
                      renderReportStatus(
                        messageReport,
                        "Message report status",
                        classes.messageReportStatusBox
                      )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={classes.empty}>No messages yet.</div>
          )}

          {sendMessageMutation.error && (
            <FadeIn className={notice(classes.errorBox)}>
              Message could not be sent. Please try again.
            </FadeIn>
          )}

          {!readOnly && (
            <>
              {(requestBuyerImageUploadMutation.error ||
                approveBuyerImageUploadMutation.error ||
                revokeBuyerImageUploadMutation.error) && (
                  <FadeIn className={notice(classes.errorBox)}>
                    Image sharing permissions could not be updated right now.
                  </FadeIn>
                )}

              <Collapse open={showImageRequestForm && canRequestImageUpload}>
                <div className={classes.panel}>
                  <div className={classes.field}>
                    <label className={classes.label} htmlFor="imageRequestNote">
                      Why do you need to send images?
                    </label>

                    <textarea
                      id="imageRequestNote"
                      className={classes.textarea}
                      value={imageRequestNote}
                      onChange={(event) => setImageRequestNote(event.target.value)}
                      placeholder="Optional. Explain what kind of reference images you want to send."
                      maxLength={1000}
                    />

                    <div className={classes.hint}>
                      {imageRequestNoteTrimmed.length}/1000 characters.
                    </div>

                    {imageRequestNoteError && (
                      <div className={notice(classes.errorBox)}>{imageRequestNoteError}</div>
                    )}
                  </div>

                  <div className={classes.row}>
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      onClick={() => void handleRequestImageUpload()}
                      disabled={Boolean(imageRequestNoteError) || isImageActionPending}
                    >
                      {requestBuyerImageUploadMutation.isPending
                        ? "Sending request…"
                        : "Send image request"}
                    </button>
                  </div>
                </div>
              </Collapse>

              {conversation.buyer_image_upload_status === "requested" &&
                conversation.buyer_image_upload_request_note && (
                  <div className={classes.imageNote}>
                    Client note: {conversation.buyer_image_upload_request_note}
                  </div>
                )}

              <div className={classes.composer}>
                <textarea
                  aria-label="Message"
                  className={classes.composerTextarea}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                  disabled={sendMessageMutation.isPending}
                />

                <div className={classes.composerFooter}>
                  <div className={classes.composerTools}>
                    <span className={classes.imageStatus}>
                      <span className={classes.imageStatusLabel}>Image sharing</span>
                      {getBuyerImageUploadStatusLabel(conversation.buyer_image_upload_status)}
                    </span>

                    {canRequestImageUpload && (
                      <button
                        className={classes.chatUtilityButton}
                        type="button"
                        onClick={() => setShowImageRequestForm((current) => !current)}
                        disabled={isImageActionPending}
                      >
                        {showImageRequestForm ? "Cancel image request" : "Request images"}
                      </button>
                    )}

                    {canApproveImageUpload && (
                      <button
                        className={classes.chatUtilityButton}
                        type="button"
                        onClick={() => void handleApproveImageUpload()}
                        disabled={isImageActionPending}
                      >
                        {approveBuyerImageUploadMutation.isPending
                          ? "Allowing…"
                          : approveImageUploadButtonText}
                      </button>
                    )}

                    {canRevokeImageUpload && (
                      <button
                        className={classes.chatUtilityButton}
                        type="button"
                        onClick={() => void handleRevokeImageUpload()}
                        disabled={isImageActionPending}
                      >
                        {revokeBuyerImageUploadMutation.isPending
                          ? "Disabling…"
                          : "Disable images"}
                      </button>
                    )}
                  </div>

                  <div className={classes.composerSend}>
                    <span className={classes.counter}>
                      {trimmedBody.length}/2000 characters
                    </span>

                    <button
                      className={classes.btnSend}
                      type="button"
                      onClick={() => void handleSubmitMessage()}
                      disabled={!canSubmit}
                    >
                      {sendMessageMutation.isPending ? "Sending…" : "Send message"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Remount per conversation so drafts and open forms never carry over to a different chat.
const MessageDetailsPage = () => {
  const { id } = useParams<{ id: string }>();

  return <MessageDetails key={id} />;
};

export default MessageDetailsPage;
