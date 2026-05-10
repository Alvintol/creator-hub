import { Link } from "react-router-dom";
import {
  getConversationInitiationReasonLabel,
} from "../../domain/conversations/conversations";
import { useMessagesInbox } from "../../hooks/conversations/useMessagesInbox";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  grid: "grid gap-4 lg:grid-cols-2",
  card: "card p-5",
  titleRow: "flex flex-wrap items-start justify-between gap-3",
  title: "text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  unreadPill:
    "inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800",
  statusPill:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",

  activityBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 my-2 px-4 py-3 text-sm text-zinc-700",
  activityTitle: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  activityText: "mt-1 text-sm text-zinc-800",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  summaryBox:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  summaryStrong: "font-extrabold text-zinc-900",
  moderationNav:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm",
  moderationNavInner:
    "flex flex-wrap items-center justify-between gap-3",
  moderationNavTextWrap: "space-y-1",
  moderationNavTitle: "text-sm font-extrabold text-zinc-900",
  moderationNavText: "text-sm text-zinc-600",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const dateTimeText = (value: string | null) => {
  if (!value) return "No activity yet";

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
  fallback = "Unknown user"
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallback);

const conversationTypeText = (value: string) =>
  value === "listing_request"
    ? "Request conversation"
    : value === "listing_inquiry"
      ? "Listing inquiry"
      : "Creator inquiry";

const conversationStatusText = (status: string) =>
  status === "open" ? "Open" : status === "closed" ? "Ended" : "Admin locked";

const latestSenderText = (
  senderUserId: string | null,
  buyerUserId: string,
  creatorUserId: string
) =>
  !senderUserId
    ? "No messages yet"
    : senderUserId === buyerUserId
      ? "Client"
      : senderUserId === creatorUserId
        ? "Creator"
        : "System";

const getConversationHref = (item: {
  viewerRole: "buyer" | "creator";
  conversation: {
    id: string;
    conversation_type: string;
    listing_request_id: string | null;
  };
}) =>
  item.conversation.conversation_type === "listing_request" &&
    item.conversation.listing_request_id
    ? item.viewerRole === "creator"
      ? `/creator/requests/${item.conversation.listing_request_id}`
      : `/requests/${item.conversation.listing_request_id}`
    : `/messages/${item.conversation.id}`;

const MessagesInbox = () => {
  const { data, isLoading, error } = useMessagesInbox();

  const items = data?.items ?? [];
  const totalUnreadCount = data?.totalUnreadCount ?? 0;

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Messages</h1>

        <p className={classes.sub}>
          Messages, listing inquiries, creator inquiries, and request conversations.
        </p>
      </div>

      <div className={classes.moderationNav}>
        <div className={classes.moderationNavInner}>
          <div className={classes.moderationNavTextWrap}>
            <div className={classes.moderationNavTitle}>Moderation reports</div>

            <p className={classes.moderationNavText}>
              Track reports you have submitted and check review updates from admins.
            </p>
          </div>

          <Link className={classes.btnOutline} to="/settings/reports">
            My reports
          </Link>
        </div>
      </div>

      {!isLoading && !error && (
        <div className={classes.summaryBox}>
          <span className={classes.summaryStrong}>
            {totalUnreadCount}
          </span>{" "}
          unread {totalUnreadCount === 1 ? "message" : "messages"} across{" "}
          <span className={classes.summaryStrong}>{items.length}</span>{" "}
          {items.length === 1 ? "conversation" : "conversations"}.
        </div>
      )}

      {error && (
        <div className={classes.errorCard}>
          Messages could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading messages…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>You do not have any inquiry messages yet.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className={classes.grid}>
          {items.map((item) => (
            <div key={item.conversation.id} className={classes.card}>
              <div className={classes.titleRow}>
                <h2 className={classes.title}>
                  {item.listing?.title ??
                    item.conversation.subject ??
                    conversationTypeText(item.conversation.conversation_type)}
                </h2>

                {item.hasUnread && (
                  <span className={classes.unreadPill}>
                    {item.unreadCount} new {item.unreadCount === 1 ? "message" : "messages"}
                  </span>
                )}
              </div>

              <p className={classes.text}>
                With: {profileText(item.otherParticipant, item.otherParticipantUserId)}
              </p>

              <div className={classes.metaGrid}>
                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Type</div>
                  <div className={classes.metaValue}>
                    {conversationTypeText(item.conversation.conversation_type)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Topic</div>
                  <div className={classes.metaValue}>
                    {getConversationInitiationReasonLabel(
                      item.conversation.initiation_reason_code
                    )}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Status</div>
                  <div className={classes.statusPill}>
                    {conversationStatusText(item.conversation.status)}
                  </div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Updated</div>
                  <div className={classes.metaValue}>
                    {dateTimeText(item.conversation.updated_at)}
                  </div>
                </div>
              </div>

              <div className={classes.activityBox}>
                {/* <div className={classes.activityTitle}>Latest activity</div>

                <div className={classes.activityText}>
                  {dateTimeText(
                    item.conversation.last_message_at ??
                    item.conversation.updated_at
                  )}
                </div>
                */}

                <div className={classes.activityText}>
                  From:{" "}
                  {latestSenderText(
                    item.conversation.last_message_sender_user_id,
                    item.conversation.buyer_user_id,
                    item.conversation.creator_user_id
                  )}
                </div>

                <div className={classes.activityText}>
                  {item.hasUnread ? "Unread: " : ""}
                  {item.conversation.last_message_preview || "No messages yet."}
                </div>
              </div>

              <div className={classes.row}>
                <Link
                  className={classes.btnPrimary}
                  to={getConversationHref(item)}
                >
                  Open conversation
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesInbox;