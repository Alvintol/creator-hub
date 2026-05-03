import { useState } from "react";
import {
  canSendConversationMessage,
  conversationCloseReasonOptions,
  getBuyerImageUploadStatusLabel,
  getConversationCloseReasonLabel,
  isConversationReadOnly,
  type ConversationCloseReasonCode,
} from "../domain/conversations/conversations";
import {
  conversationModerationReportReasonOptions,
  getModerationReportStatusLabel,
  getModerationReportStatusSummary,
  type ModerationReportReasonCode,
} from "../domain/moderation/moderationReports";
import { useCloseConversation } from "../hooks/conversations/useCloseConversation";
import { useConversationMessages } from "../hooks/conversations/useConversationMessages";
import { useRequestConversation } from "../hooks/conversations/useRequestConversation";
import { useApproveBuyerImageUpload, useRequestBuyerImageUpload, useRevokeBuyerImageUpload } from '../hooks/conversations/useConversationImagePermissions';
import { useSubmitModerationReport } from "../hooks/moderation/useSubmitModerationReport";
import { useMyModerationReports } from "../hooks/moderation/useMyModerationReports";


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

const classes = {
  card: "card p-6 space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  statusBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  closedStatusBox:
    "rounded-2xl border-2 border-zinc-300 bg-zinc-300/70 px-5 py-4 text-sm text-zinc-800 shadow-[0_100px_30px_rgba(0,0,0,0.08)]",
  warningBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  closedStatusTitle: "text-sm font-extrabold tracking-tight text-zinc-900",
  closedStatusList: "mt-3 space-y-2 text-sm text-zinc-700",
  closedStatusLabel: "font-semibold text-zinc-900",

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

  form: "space-y-3 border-t border-zinc-200 pt-4",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  hint: "text-xs text-zinc-500",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  textarea:
    "min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
  formFooter: "flex flex-wrap items-center justify-between gap-3",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  imagePermissionBox:
    "rounded-2xl border border-zinc-300 bg-zinc-100/60 px-4 py-3 text-sm text-zinc-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  imagePermissionTitle: "font-extrabold text-zinc-900",
  imagePermissionText: "mt-1 text-sm text-zinc-700",
  imagePermissionActions: "mt-3 flex flex-wrap items-center gap-3",

  reportBox:
    "rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4 text-sm text-red-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  reportTitle: "font-extrabold text-red-900",
  messageActions: "mt-2 flex flex-wrap items-center gap-2",
  tinyDangerButton:
    "inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60",
  successBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800",
  reportStatusBox:
    "rounded-2xl border border-rose-300 bg-rose-100/70 my-2 px-4 py-3 text-sm text-zinc-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)]",
  reportStatusTitle: "font-extrabold text-zinc-900",
  reportStatusText: "mt-1 text-sm text-zinc-700",
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

  const { data: myReports = [] } = useMyModerationReports(
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
        <h2 className={classes.title}>Messages</h2>
        <div className={classes.errorBox}>
          Conversation could not be loaded right now.
        </div>
      </div>
    );
  }

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <h2 className={classes.title}>Messages</h2>
        <p className={classes.sub}>
          Follow-up messages linked to this request.
        </p>
      </div>

      {conversation.status === "closed" && (
        <div className={classes.closedStatusBox}>
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
        <div className={classes.warningBox}>
          This conversation has been locked by an admin and is read-only.
        </div>
      )}

      {requestReadOnly && conversation.status === "open" && (
        <div className={classes.statusBox}>
          Archived requests are read-only.
        </div>
      )}

      <div className={classes.imagePermissionBox}>
        <div className={classes.imagePermissionTitle}>
          Image sharing
        </div>

        <div className={classes.imagePermissionText}>
          {getBuyerImageUploadStatusLabel(conversation.buyer_image_upload_status)}
        </div>

        {conversation.buyer_image_upload_status === "blocked" && (
          <div className={classes.imagePermissionText}>
            Clients cannot send images in this conversation unless the creator allows it.
          </div>
        )}

        {conversation.buyer_image_upload_status === "requested" && (
          <div className={classes.imagePermissionText}>
            The client has requested permission to send images.
            {conversation.buyer_image_upload_request_note
              ? ` Note: ${conversation.buyer_image_upload_request_note}`
              : ""}
          </div>
        )}

        {conversation.buyer_image_upload_status === "approved" && (
          <div className={classes.imagePermissionText}>
            The creator has allowed the client to send images when uploads are added later.
          </div>
        )}

        {conversation.buyer_image_upload_status === "revoked" && (
          <div className={classes.imagePermissionText}>
            The creator has disabled client image sharing for this conversation.
          </div>
        )}

        {(requestBuyerImageUploadMutation.error ||
          approveBuyerImageUploadMutation.error ||
          revokeBuyerImageUploadMutation.error) && (
            <div className={classes.errorBox}>
              Image sharing permissions could not be updated right now.
            </div>
          )}

        {canRequestImageUpload && (
          <div className={classes.imagePermissionActions}>
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => setShowImageRequestForm((current) => !current)}
              disabled={isImageActionPending}
            >
              {showImageRequestForm
                ? "Cancel image request"
                : "Request image sharing"}
            </button>
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

        {canApproveImageUpload && (
          <div className={classes.imagePermissionActions}>
            <button
              className={classes.btnPrimary}
              type="button"
              onClick={() => void handleApproveImageUpload()}
              disabled={isImageActionPending}
            >
              {approveBuyerImageUploadMutation.isPending
                ? "Allowing images…"
                : approveImageUploadButtonText}
            </button>
          </div>
        )}

        {canRevokeImageUpload && (
          <div className={classes.imagePermissionActions}>
            <button
              className={classes.btnDanger}
              type="button"
              onClick={() => void handleRevokeImageUpload()}
              disabled={isImageActionPending}
            >
              {revokeBuyerImageUploadMutation.isPending
                ? "Disabling images…"
                : "Disable client images"}
            </button>
          </div>
        )}
      </div>

      {viewer !== "admin" && (
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
      )}

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
                  {!isSystemMessage && (
                    <div className={classes.messageMeta}>
                      <span className={classes.messageRole}>
                        {senderRoleText(
                          message.sender_user_id,
                          buyerUserId,
                          creatorUserId
                        )}
                      </span>

                      <span>
                        {senderLabelText(
                          message.sender_user_id,
                          buyerUserId,
                          creatorUserId,
                          buyerLabel,
                          creatorLabel
                        )}
                      </span>

                      <span>·</span>

                      <span>{dateText(message.created_at)}</span>
                    </div>
                  )}

                  {isSystemMessage && (
                    <div className={classes.messageMeta}>
                      <span>System · {dateText(message.created_at)}</span>
                    </div>
                  )}

                  <div className={classes.messageBody}>{message.body}</div>
                  {!isSystemMessage && viewer !== "admin" && message.sender_user_id !== currentUserId && (
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

                  {messageReport && viewer !== "admin" && (
                    <div className={classes.reportStatusBox}>
                      <div className={classes.reportStatusTitle}>
                        Message report status
                      </div>

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
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={classes.empty}>No follow-up messages yet.</div>
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

      {conversationReport && viewer !== "admin" && (
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

      {sendMessageMutation.error && (
        <div className={classes.errorBox}>
          Message could not be sent. Please check the conversation status and try
          again.
        </div>
      )}

      {closeConversationMutation.error && (
        <div className={classes.errorBox}>
          Conversation could not be ended right now.
        </div>
      )}

      {!readOnly && (
        <div className={classes.form}>
          <textarea
            className={classes.textarea}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a follow-up message…"
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

      {isAdmin && (
        <div className={classes.empty}>
          Admins can review request messages, but cannot send replies.
        </div>
      )}

      {canCloseConversation && (
        <div className={classes.form}>
          <div className={classes.row}>
            <button
              className={classes.btnDanger}
              type="button"
              onClick={() => setShowCloseForm((current) => !current)}
            >
              {showCloseForm ? "Cancel ending conversation" : "End conversation"}
            </button>
          </div>

          {showCloseForm && (
            <>
              <div className={classes.warningBox}>
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
                  <div className={classes.errorBox}>{closeReasonDetailsError}</div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestConversationThread;