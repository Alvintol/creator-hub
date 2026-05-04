import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  canSendConversationMessage,
  getConversationInitiationReasonLabel,
  isConversationReadOnly,
} from "../../domain/conversations/conversations";
import { useConversationDetails } from "../../hooks/conversations/useConversationDetails";
import { useConversationMessages } from "../../hooks/conversations/useConversationMessages";
import { useConversationParticipants } from "../../hooks/conversations/useConversationParticipants";
import { useMarkConversationRead } from "../../hooks/conversations/useMarkConversationRead";

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

  const { data: participants = [] } = useConversationParticipants(
    conversation?.id ?? null
  );

  const markConversationReadMutation = useMarkConversationRead();
  const lastMarkedReadMessageAtRef = useRef<string | null>(null);

  const trimmedBody = body.trim();

  const readOnly =
    !conversation || isConversationReadOnly(conversation.status);

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

              const rowClassName = `${classes.messageRow} ${
                isSystemMessage
                  ? classes.messageRowSystem
                  : isOwnMessage
                    ? classes.messageRowOwn
                    : classes.messageRowOther
              }`;

              const bubbleClassName = `${classes.messageBubble} ${
                isSystemMessage
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

        {!readOnly && (
          <div className={classes.form}>
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