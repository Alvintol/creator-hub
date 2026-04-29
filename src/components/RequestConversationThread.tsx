import { useState } from "react";
import {
  canSendConversationMessage,
  conversationCloseReasonOptions,
  getConversationCloseReasonLabel,
  isConversationReadOnly,
  type ConversationCloseReasonCode,
} from "../domain/conversations/conversations";
import { useCloseConversation } from "../hooks/conversations/useCloseConversation";
import { useConversationMessages } from "../hooks/conversations/useConversationMessages";
import { useRequestConversation } from "../hooks/conversations/useRequestConversation";

type RequestConversationThreadProps = {
  requestId: string;
  buyerUserId: string;
  creatorUserId: string;
  buyerLabel: string;
  creatorLabel: string;
  viewer: "buyer" | "creator" | "admin";
  requestArchived?: boolean;
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
  requestArchived = false,
}: RequestConversationThreadProps) => {
  const [body, setBody] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReasonCode, setCloseReasonCode] =
    useState<ConversationCloseReasonCode | "">("");
  const [closeReasonDetails, setCloseReasonDetails] = useState("");

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

  const trimmedBody = body.trim();
  const isAdmin = viewer === "admin";
  const readOnlyByConversation =
    !conversation || isConversationReadOnly(conversation.status);
  const readOnly = isAdmin || requestArchived || readOnlyByConversation;

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
    !requestArchived &&
    conversation?.status === "open";

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

      {requestArchived && conversation.status === "open" && (
        <div className={classes.statusBox}>
          Archived requests are read-only.
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
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={classes.empty}>No follow-up messages yet.</div>
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