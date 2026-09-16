import { useEffect, useRef, useState } from "react";
import {
  canSendConversationMessage,
  conversationCloseReasonOptions,
  getBuyerImageUploadStatusLabel,
  getConversationCloseReasonLabel,
  isConversationReadOnly,
  type ConversationCloseReasonCode,
} from "../../../domain/conversations/conversations";
import {
  conversationModerationReportReasonOptions,
  getModerationReportStatusLabel,
  getModerationReportStatusSummary,
  type ModerationReportReasonCode,
} from "../../../domain/moderation/moderationReports";
import { useCloseConversation } from "../../../hooks/conversations/useCloseConversation";
import { useConversationMessages } from "../../../hooks/conversations/useConversationMessages";
import { useRequestConversation } from "../../../hooks/conversations/useRequestConversation";
import { useApproveBuyerImageUpload, useRequestBuyerImageUpload, useRevokeBuyerImageUpload } from '../../../hooks/conversations/useConversationImagePermissions';
import { useSubmitModerationReport } from "../../../hooks/moderation/useSubmitModerationReport";
import { useMyModerationReports } from "../../../hooks/moderation/useMyModerationReports";
import { useMarkConversationRead } from '../../../hooks/conversations/useMarkConversationRead';
import { useConversationParticipants } from '../../../hooks/conversations/useConversationParticipants';
import { Collapse, FadeIn, useStaggerIn } from "../../../lib/motion";


type RequestConversationThreadProps = {
  requestId: string;
  buyerUserId: string;
  creatorUserId: string;
  buyerLabel: string;
  creatorLabel: string;
  viewer: "buyer" | "creator" | "admin";
  requestReadOnly?: boolean;
  requestReadOnlyMessage?: string;
};

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

const senderRoleText = (
  senderUserId: string,
  buyerUserId: string,
  creatorUserId: string
) =>
  senderUserId === buyerUserId
    ? "Client"
    : senderUserId === creatorUserId
      ? "Creator"
      : "System";

const senderLabelText = (
  senderUserId: string,
  buyerUserId: string,
  creatorUserId: string,
  buyerLabel: string,
  creatorLabel: string
) =>
  senderUserId === buyerUserId
    ? buyerLabel
    : senderUserId === creatorUserId
      ? creatorLabel
      : "CreatorHub";

const RequestConversationThread = ({
  requestId,
  buyerUserId,
  creatorUserId,
  buyerLabel,
  creatorLabel,
  viewer,
  requestReadOnly = false,
  requestReadOnlyMessage = "This request is read-only.",
}: RequestConversationThreadProps) => {
  const [body, setBody] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReasonCode, setCloseReasonCode] =
    useState<ConversationCloseReasonCode | "">("");
  const [closeReasonDetails, setCloseReasonDetails] = useState("");
  const [showImageRequestForm, setShowImageRequestForm] = useState(false);
  const [imageRequestNote, setImageRequestNote] = useState("");

  const [reportTarget, setReportTarget] = useState<{
    type: "conversation" | "message";
    messageId: string | null;
  } | null>(null);

  const [reportReasonCode, setReportReasonCode] =
    useState<ModerationReportReasonCode | "">("");

  const [reportReasonDetails, setReportReasonDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportPanelType, setReportPanelType] =
    useState<"conversation" | "message">("conversation");

  const {
    data: conversation,
    isLoading: isConversationLoading,
    error: conversationError,
  } = useRequestConversation(requestId);

  const {
    messages,
    isLoading: areMessagesLoading,
    error: messagesError,
    currentUserId,
    sendMessageMutation,
  } = useConversationMessages(conversation?.id ?? null);

  const closeConversationMutation = useCloseConversation();
  const requestBuyerImageUploadMutation = useRequestBuyerImageUpload();
  const approveBuyerImageUploadMutation = useApproveBuyerImageUpload();
  const revokeBuyerImageUploadMutation = useRevokeBuyerImageUpload();
  const reportConversationMutation = useSubmitModerationReport();
  const markConversationReadMutation = useMarkConversationRead();

  const lastMarkedReadMessageAtRef = useRef<string | null>(null);

  const { data: myReports = [] } =
    useMyModerationReports();

  const { data: participants = [] } = useConversationParticipants(
    conversation?.id ?? null
  );

  const reportReasonDetailsTrimmed = reportReasonDetails.trim();
  const isOtherReportReason = reportReasonCode === "other";

  const reportReasonDetailsError =
    isOtherReportReason && reportReasonDetailsTrimmed.length < 10
      ? "Please provide a reason for the report"
      : reportReasonDetailsTrimmed.length > 1000
        ? "Additional details must be 1000 characters or less"
        : null;

  const canSubmitReport =
    Boolean(conversation) &&
    Boolean(reportTarget) &&
    Boolean(reportReasonCode) &&
    !reportReasonDetailsError &&
    !reportConversationMutation.isPending;

  const conversationReport =
    conversation
      ? myReports.find(
        (report) =>
          report.target_type === "conversation" &&
          report.conversation_id ===
          conversation.id
      ) ?? null
      : null;

  const getMessageReport = (
    messageId: string
  ) =>
    conversation
      ? myReports.find(
        (report) =>
          report.target_type ===
          "conversation_message" &&
          report.conversation_id ===
          conversation.id &&
          report.message_id === messageId
      ) ?? null
      : null;

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

  const trimmedBody = body.trim();
  const isAdmin = viewer === "admin";
  const readOnlyByConversation =
    !conversation || isConversationReadOnly(conversation.status);
  const readOnly = isAdmin || requestReadOnly || readOnlyByConversation;

  const closeReasonDetailsTrimmed = closeReasonDetails.trim();
  const isOtherCloseReason = closeReasonCode === "other";

  const closeReasonDetailsError =
    isOtherCloseReason && closeReasonDetailsTrimmed.length < 10
      ? "Please give more detail"
      : null;

  const otherParticipantUserId =
    viewer === "buyer"
      ? creatorUserId
      : viewer === "creator"
        ? buyerUserId
        : null;

  const otherParticipantLabel =
    viewer === "buyer"
      ? "Creator"
      : viewer === "creator"
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

  useEffect(() => {
    if (!conversation || viewer === "admin" || !currentUserId) return;

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
  }, [
    conversation,
    currentUserId,
    markConversationReadMutation,
    viewer,
  ]);

  const canConfirmCloseConversation =
    Boolean(closeReasonCode) &&
    !closeReasonDetailsError &&
    !closeConversationMutation.isPending;

  const canSubmit =
    Boolean(conversation) &&
    !readOnly &&
    canSendConversationMessage(conversation.status) &&
    trimmedBody.length >= 1 &&
    trimmedBody.length <= 2000 &&
    !sendMessageMutation.isPending;

  const canCloseConversation =
    Boolean(conversation) &&
    !isAdmin &&
    !requestReadOnly &&
    conversation?.status === "open";

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
    viewer === "buyer" &&
    !readOnly &&
    (buyerImageUploadStatus === "blocked" ||
      buyerImageUploadStatus === "revoked");

  const canApproveImageUpload =
    Boolean(conversation) &&
    viewer === "creator" &&
    !readOnly &&
    buyerImageUploadStatus !== "approved";

  const canRevokeImageUpload =
    Boolean(conversation) &&
    viewer === "creator" &&
    !readOnly &&
    buyerImageUploadStatus === "approved";

  const approveImageUploadButtonText =
    buyerImageUploadStatus === "requested"
      ? "Allow client images"
      : "Enable client images";

  const handleSubmitMessage = async () => {
    if (!canSubmit) return;

    try {
      await sendMessageMutation.mutateAsync(trimmedBody);
      setBody("");
    } catch {
      // Error is surfaced below
    }
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

  const handleSubmitReport = async () => {
    if (!conversation || !reportTarget || !reportReasonCode || reportReasonDetailsError) return;

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

  const threadRef = useRef<HTMLDivElement>(null);

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
        <h2 className={classes.title}>Messages</h2>
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
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.headerText}>
          <h2 className={classes.title}>Messages</h2>
          <p className={classes.sub}>
            Follow-up messages linked to this request.
          </p>
        </div>

        {viewer !== "admin" && (
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
        )}
      </div>

      <div className={classes.body}>
        {conversation.status === "closed" && (
          <div className={notice(classes.statusBox)}>
            <div className={classes.closedStatusTitle}>Conversation ended</div>

            <div className={classes.closedStatusList}>
              <div>
                <span className={classes.closedStatusLabel}>Status:</span> This conversation has been ended and is now read-only for both parties.
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

        {requestReadOnly &&
          conversation.status === "open" && (
            <div className={notice(classes.warningBox)}>
              {requestReadOnlyMessage}
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
                  : " Optional, but can be helpful for both parties and admins when reviewing the conversation history."}
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

        {conversationReport && viewer !== "admin" &&
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
                      System · {dateText(message.created_at)}
                    </div>
                    <div className={classes.systemMessage}>{message.body}</div>
                  </div>
                );
              }

              const canReportMessage = viewer !== "admin" && !isOwnMessage;

              return (
                <div
                  key={message.id}
                  className={`${classes.messageRow} ${isOwnMessage ? classes.messageRowOwn : classes.messageRowOther}`}
                >
                  <div
                    className={`${classes.messageMeta} ${isOwnMessage ? "justify-end" : ""}`}
                  >
                    <span className={classes.messageName}>
                      {senderLabelText(
                        message.sender_user_id,
                        buyerUserId,
                        creatorUserId,
                        buyerLabel,
                        creatorLabel
                      )}
                    </span>

                    <span className={classes.messageRole}>
                      {senderRoleText(
                        message.sender_user_id,
                        buyerUserId,
                        creatorUserId
                      )}
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
                        Read by {otherParticipantLabel} · {dateText(otherParticipantLastReadAt)}
                      </div>
                    )}

                  {canReportMessage && (
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

                  {messageReport && viewer !== "admin" &&
                    renderReportStatus(
                      messageReport,
                      "Message Report Status",
                      classes.messageReportStatusBox
                    )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={classes.empty}>No follow-up messages yet.</div>
        )}

        {sendMessageMutation.error && (
          <FadeIn className={notice(classes.errorBox)}>
            Message could not be sent. Please check the conversation status and try
            again.
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
                placeholder="Write a follow-up message…"
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

        {isAdmin && (
          <div className={classes.adminNote}>
            Admins can review request messages, but cannot send replies.
          </div>
        )}
      </div>
    </div>
  );
};

// Remount per request so drafts and open forms never carry over to a different chat.
const KeyedRequestConversationThread = (props: RequestConversationThreadProps) => (
  <RequestConversationThread key={props.requestId} {...props} />
);

export default KeyedRequestConversationThread;
