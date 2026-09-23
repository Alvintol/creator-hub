// Sprint 6 (launch-scope.md section 7): pure mirrors of the 7+7 day clock
// and "substantive reply" logic that
// supabase/migrations/20260922_131_add_listing_request_notices.sql enforces
// server-side. The SQL functions are the source of truth for anything that
// moves money or changes a request's status -- this module exists so the
// workspace UI can show an accurate countdown and disable actions that the
// server would refuse anyway, without a round-trip, and so that logic has
// test coverage the way every other sprint's mirrored arithmetic does
// (see e.g. src/domain/payments/listingRequestPaymentRefunds.ts).

export type ListingRequestNoticeType = "first" | "final";

export type ListingRequestNoticeEmailStatus =
  | "pending"
  | "sent"
  | "failed"
  | "bounced";

export type ListingRequestNotice = {
  id: string;
  notice_type: ListingRequestNoticeType;
  sender_user_id: string;
  recipient_user_id: string;
  requested_action: string;
  sent_at: string;
  expires_at: string;
  answered_at: string | null;
  email_status: ListingRequestNoticeEmailStatus;
};

export type ConversationMessageForReplyCheck = {
  sender_user_id: string;
  message_type: string;
  created_at: string;
};

export const NOTICE_WAIT_DAYS = 7;

// A message from the notice's recipient whose type is not 'system' counts
// as a substantive reply -- matches
// listing_request_has_substantive_reply(uuid, uuid, timestamptz) exactly.
// An automated acknowledgement never has any other message_type in this
// schema (see docs/support/... and 20260429_032's message type check), so
// excluding 'system' is sufficient without a separate "is automated" flag.
export const hasSubstantiveReplyAfter = (
  messages: ConversationMessageForReplyCheck[],
  recipientUserId: string,
  sinceIso: string
): boolean =>
  messages.some(
    (message) =>
      message.sender_user_id === recipientUserId &&
      message.message_type !== "system" &&
      message.created_at > sinceIso
  );

export const canSendFinalNotice = (
  firstNotice: Pick<ListingRequestNotice, "notice_type" | "expires_at" | "answered_at">,
  now: Date = new Date()
): boolean =>
  firstNotice.notice_type === "first" &&
  firstNotice.answered_at === null &&
  now >= new Date(firstNotice.expires_at);

export const canRequestClosure = (
  finalNotice: Pick<ListingRequestNotice, "notice_type" | "expires_at" | "answered_at">,
  now: Date = new Date()
): boolean =>
  finalNotice.notice_type === "final" &&
  finalNotice.answered_at === null &&
  now >= new Date(finalNotice.expires_at);

export type ListingRequestNoticeClockState =
  | { state: "no_notice" }
  | { state: "first_notice_waiting"; expiresAt: string }
  | { state: "first_notice_expired"; expiresAt: string }
  | { state: "final_notice_waiting"; expiresAt: string }
  | { state: "final_notice_expired"; expiresAt: string }
  | { state: "answered"; answeredAt: string };

// Reduces a request's notice history (most recent first, or in any order)
// down to the single state the workspace UI needs to render. Only the
// latest notice cycle matters -- a request can only ever have one open
// cycle at a time, enforced server-side.
export const getListingRequestNoticeClockState = (
  notices: ListingRequestNotice[],
  now: Date = new Date()
): ListingRequestNoticeClockState => {
  if (notices.length === 0) {
    return { state: "no_notice" };
  }

  const sorted = [...notices].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  const latest = sorted[0];

  if (latest.answered_at) {
    return { state: "answered", answeredAt: latest.answered_at };
  }

  const expired = now >= new Date(latest.expires_at);

  if (latest.notice_type === "first") {
    return expired
      ? { state: "first_notice_expired", expiresAt: latest.expires_at }
      : { state: "first_notice_waiting", expiresAt: latest.expires_at };
  }

  return expired
    ? { state: "final_notice_expired", expiresAt: latest.expires_at }
    : { state: "final_notice_waiting", expiresAt: latest.expires_at };
};
