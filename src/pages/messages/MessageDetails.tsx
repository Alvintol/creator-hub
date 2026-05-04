import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  canSendConversationMessage,
  getBuyerImageUploadStatusLabel,
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

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  card: "card p-6 space-y-4",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  title: "text-base font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  statusBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  warningBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  thread: "space-y-3",
  loadingText: "text-sm text-zinc-600",
  empty:
    "rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm text-zinc-600",

  messageRow: "flex",
  messageRowOwn: "justify-end",
  messageRowOther: "justify-start",
  messageRowSystem: "justify-center",

  messageBubble:
    "max-w-[min(100%,42rem)] rounded-2xl border px-4 py-3 shadow-sm",
  messageBubbleOwn: "border-orange-200 bg-orange-50",
  messageBubbleOther: "border-zinc-200 bg-white",
  messageBubbleSystem:
    "border-zinc-200 bg-zinc-50 text-center shadow-none",

  messageMeta:
    "mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500",
  messageRole: "uppercase tracking-wide",
  messageBody: "whitespace-pre-wrap text-sm leading-6 text-zinc-800",
  readReceipt: "mt-1 text-right text-xs font-semibold text-zinc-500",

  form: "space-y-3 border-t border-zinc-200 pt-4",
  textarea:
    "min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
  formFooter: "flex flex-wrap items-center justify-between gap-3",
  hint: "text-xs text-zinc-500",

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  row: "flex flex-wrap items-center gap-3",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  messageActions: "mt-2 flex flex-wrap items-center gap-2",
  tinyDangerButton:
    "inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60",

  reportBox:
    "rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4 text-sm text-red-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  reportTitle: "font-extrabold text-red-900",
  reportStatusBox:
    "rounded-2xl border border-rose-300 bg-rose-100/70 my-2 px-4 py-3 text-sm text-zinc-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  reportStatusTitle: "font-extrabold text-zinc-900",
  reportStatusText: "mt-1 text-sm font-semibold text-zinc-700",
  successBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",
  chatUtilityBar:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  chatUtilityHeader:
    "flex flex-wrap items-center justify-between gap-3",
  chatUtilityTitle: "text-sm font-extrabold text-zinc-900",
  chatUtilityText: "mt-1 text-sm text-zinc-600",
  chatUtilityActions: "flex flex-wrap items-center gap-2",
  chatUtilityButton:
    "inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60",
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

  const [reportReasonCode, setReportReasonCode] =
    useState<ModerationReportReasonCode | "">("");

  const [reportReasonDetails, setReportReasonDetails] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

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

  const { data: myReports = [] } = useMyModerationReports(
    conversation?.id ?? null
  );

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

  const conversationReport =
    myReports.find((report) => report.target_type === "conversation") ?? null;

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

  if (isConversationLoading) {
    return (
      <div className={classes.card}>
        <div className={classes.loadingText}>Loading conversation…</div>
      </div>
    );
  }

  if (conversationError || !conversation) {
    return (
      <div className={classes.card}>
        <h1 className={classes.h1}>Conversation</h1>
        <div className={classes.errorBox}>
          Conversation could not be loaded right now.
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link to="/messages" className={classes.backLink}>
        ← Back to messages
      </Link>

      <div className={classes.card}>
        <div className={classes.header}>
          <h1 className={classes.h1}>
            {listing?.title ?? conversation.subject ?? "Conversation"}
          </h1>

          <p className={classes.sub}>
            Topic:{" "}
            {getConversationInitiationReasonLabel(
              conversation.initiation_reason_code
            )}
          </p>

          <p className={classes.sub}>
            Client: {profileText(buyer, conversation.buyer_user_id)} · Creator:{" "}
            {profileText(creator, conversation.creator_user_id)}
          </p>
        </div>

        {conversation.status === "closed" && (
          <div className={classes.statusBox}>
            This conversation has ended and is now read-only.
          </div>
        )}

        {conversation.status === "admin_locked" && (
          <div className={classes.warningBox}>
            This conversation has been locked by an admin and is read-only.
          </div>
        )}

        {conversationReport && (
          <div className={classes.reportStatusBox}>
            <div className={classes.reportStatusTitle}>
              Conversation report status
            </div>

            <div className={classes.reportStatusText}>
              Status: {getModerationReportStatusLabel(conversationReport.status)}
            </div>

            <div className={classes.reportStatusText}>
              {conversationReport.reporter_status_message ||
                getModerationReportStatusSummary(conversationReport.status)}
            </div>

            {conversationReport.reporter_status_updated_at && (
              <div className={classes.reportStatusText}>
                Last update: {dateText(conversationReport.reporter_status_updated_at)}
              </div>
            )}
          </div>
        )}

        <div className={classes.row}>
          <button
            className={classes.btnOutline}
            type="button"
            onClick={openConversationReport}
            disabled={hasReportedConversation || reportConversationMutation.isPending}
          >
            {getReportedConversationButtonText()}
          </button>
        </div>

        {areMessagesLoading ? (
          <div className={classes.loadingText}>Loading messages…</div>
        ) : messagesError ? (
          <div className={classes.errorBox}>
            Messages could not be loaded right now.
          </div>
        ) : messages.length > 0 ? (
          <div className={classes.thread}>
            {messages.map((message) => {
              const isSystemMessage = message.message_type === "system";
              const isOwnMessage = message.sender_user_id === currentUserId;
              const messageReport = getMessageReport(message.id);

              const rowClassName = `${classes.messageRow} ${isSystemMessage
                ? classes.messageRowSystem
                : isOwnMessage
                  ? classes.messageRowOwn
                  : classes.messageRowOther
                }`;

              const bubbleClassName = `${classes.messageBubble} ${isSystemMessage
                ? classes.messageBubbleSystem
                : isOwnMessage
                  ? classes.messageBubbleOwn
                  : classes.messageBubbleOther
                }`;

              return (
                <div key={message.id} className={rowClassName}>
                  <div className={bubbleClassName}>
                    <div className={classes.messageMeta}>
                      <span className={classes.messageRole}>
                        {isSystemMessage
                          ? "System"
                          : senderRoleText(message.sender_user_id)}
                      </span>

                      <span>
                        {isSystemMessage
                          ? "CreatorHub"
                          : senderLabelText(message.sender_user_id)}
                      </span>

                      <span>·</span>

                      <span>{dateText(message.created_at)}</span>
                    </div>

                    <div className={classes.messageBody}>{message.body}</div>
                    {!isSystemMessage && !isOwnMessage && (
                      <div className={classes.messageActions}>
                        <button
                          className={classes.tinyDangerButton}
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

                    {messageReport && (
                      <div className={classes.reportStatusBox}>
                        <div className={classes.reportStatusTitle}>Message report status</div>

                        <div className={classes.reportStatusText}>
                          Status: {getModerationReportStatusLabel(messageReport.status)}
                        </div>

                        <div className={classes.reportStatusText}>
                          {messageReport.reporter_status_message ||
                            getModerationReportStatusSummary(messageReport.status)}
                        </div>

                        {messageReport.reporter_status_updated_at && (
                          <div className={classes.reportStatusText}>
                            Last update: {dateText(messageReport.reporter_status_updated_at)}
                          </div>
                        )}
                      </div>
                    )}

                    {message.id === latestReadOwnMessageId &&
                      otherParticipantLabel &&
                      otherParticipantLastReadAt && (
                        <div className={classes.readReceipt}>
                          Read by {otherParticipantLabel} ·{" "}
                          {dateText(otherParticipantLastReadAt)}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={classes.empty}>No messages yet.</div>
        )}

        {sendMessageMutation.error && (
          <div className={classes.errorBox}>
            Message could not be sent. Please try again.
          </div>
        )}

        {reportSubmitted && (
          <div className={classes.successBox}>
            Report submitted. An admin can review it.
          </div>
        )}

        {reportConversationMutation.error && (
          <div className={classes.errorBox}>
            Report could not be submitted right now.
          </div>
        )}

        {reportTarget && (
          <div className={classes.reportBox}>
            <div className={classes.reportTitle}>
              {reportTarget.type === "message"
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
                <div className={classes.errorBox}>{reportReasonDetailsError}</div>
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
        )}

        {!readOnly && (
          <div className={classes.form}>
            <div className={classes.chatUtilityBar}>
              <div className={classes.chatUtilityHeader}>
                <div>
                  <div className={classes.chatUtilityTitle}>Image sharing</div>

                  <div className={classes.chatUtilityText}>
                    {getBuyerImageUploadStatusLabel(conversation.buyer_image_upload_status)}
                  </div>

                  {conversation.buyer_image_upload_status === "requested" &&
                    conversation.buyer_image_upload_request_note && (
                      <div className={classes.chatUtilityText}>
                        Client note: {conversation.buyer_image_upload_request_note}
                      </div>
                    )}
                </div>

                <div className={classes.chatUtilityActions}>
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
              </div>

              {(requestBuyerImageUploadMutation.error ||
                approveBuyerImageUploadMutation.error ||
                revokeBuyerImageUploadMutation.error) && (
                  <div className={classes.errorBox}>
                    Image sharing permissions could not be updated right now.
                  </div>
                )}

              {showImageRequestForm && canRequestImageUpload && (
                <div className={classes.form}>
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
                      <div className={classes.errorBox}>{imageRequestNoteError}</div>
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
              )}
            </div>
            <textarea
              className={classes.textarea}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message…"
              maxLength={2000}
              disabled={sendMessageMutation.isPending}
            />

            <div className={classes.formFooter}>
              <div className={classes.hint}>
                {trimmedBody.length}/2000 characters
              </div>

              <button
                className={classes.btnPrimary}
                type="button"
                onClick={() => void handleSubmitMessage()}
                disabled={!canSubmit}
              >
                {sendMessageMutation.isPending ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageDetails;