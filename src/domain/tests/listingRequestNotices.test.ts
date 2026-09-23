import { describe, expect, it } from "vitest";

import {
  canRequestClosure,
  canSendFinalNotice,
  getListingRequestNoticeClockState,
  hasSubstantiveReplyAfter,
  type ListingRequestNotice,
} from "../listings/listingRequestNotices";

const baseNotice: ListingRequestNotice = {
  id: "notice-1",
  notice_type: "first",
  sender_user_id: "creator-1",
  recipient_user_id: "buyer-1",
  requested_action: "Please confirm the revised delivery date.",
  sent_at: "2026-09-01T00:00:00.000Z",
  expires_at: "2026-09-08T00:00:00.000Z",
  answered_at: null,
  email_status: "sent",
};

describe("hasSubstantiveReplyAfter", () => {
  it("counts a text message from the recipient after the cutoff as substantive", () => {
    const result = hasSubstantiveReplyAfter(
      [
        {
          sender_user_id: "buyer-1",
          message_type: "text",
          created_at: "2026-09-02T00:00:00.000Z",
        },
      ],
      "buyer-1",
      "2026-09-01T00:00:00.000Z"
    );

    expect(result).toBe(true);
  });

  it("does not count a system message as a substantive reply", () => {
    const result = hasSubstantiveReplyAfter(
      [
        {
          sender_user_id: "buyer-1",
          message_type: "system",
          created_at: "2026-09-02T00:00:00.000Z",
        },
      ],
      "buyer-1",
      "2026-09-01T00:00:00.000Z"
    );

    expect(result).toBe(false);
  });

  it("does not count a message from the sender, not the recipient", () => {
    const result = hasSubstantiveReplyAfter(
      [
        {
          sender_user_id: "creator-1",
          message_type: "text",
          created_at: "2026-09-02T00:00:00.000Z",
        },
      ],
      "buyer-1",
      "2026-09-01T00:00:00.000Z"
    );

    expect(result).toBe(false);
  });

  it("does not count a reply sent before the cutoff", () => {
    const result = hasSubstantiveReplyAfter(
      [
        {
          sender_user_id: "buyer-1",
          message_type: "text",
          created_at: "2026-08-30T00:00:00.000Z",
        },
      ],
      "buyer-1",
      "2026-09-01T00:00:00.000Z"
    );

    expect(result).toBe(false);
  });
});

describe("canSendFinalNotice", () => {
  it("refuses before the first notice has expired", () => {
    expect(
      canSendFinalNotice(baseNotice, new Date("2026-09-05T00:00:00.000Z"))
    ).toBe(false);
  });

  it("allows once the first notice has expired and is unanswered", () => {
    expect(
      canSendFinalNotice(baseNotice, new Date("2026-09-08T00:00:01.000Z"))
    ).toBe(true);
  });

  it("refuses once the first notice was answered", () => {
    expect(
      canSendFinalNotice(
        { ...baseNotice, answered_at: "2026-09-03T00:00:00.000Z" },
        new Date("2026-09-08T00:00:01.000Z")
      )
    ).toBe(false);
  });
});

describe("canRequestClosure", () => {
  const finalNotice: ListingRequestNotice = {
    ...baseNotice,
    id: "notice-2",
    notice_type: "final",
    sent_at: "2026-09-08T00:00:00.000Z",
    expires_at: "2026-09-15T00:00:00.000Z",
  };

  it("refuses before the final notice has expired", () => {
    expect(
      canRequestClosure(finalNotice, new Date("2026-09-10T00:00:00.000Z"))
    ).toBe(false);
  });

  it("allows once the final notice has expired and is unanswered", () => {
    expect(
      canRequestClosure(finalNotice, new Date("2026-09-15T00:00:01.000Z"))
    ).toBe(true);
  });
});

describe("getListingRequestNoticeClockState", () => {
  it("returns no_notice for an empty history", () => {
    expect(getListingRequestNoticeClockState([])).toEqual({ state: "no_notice" });
  });

  it("reports the first notice as waiting before expiry", () => {
    expect(
      getListingRequestNoticeClockState(
        [baseNotice],
        new Date("2026-09-05T00:00:00.000Z")
      )
    ).toEqual({ state: "first_notice_waiting", expiresAt: baseNotice.expires_at });
  });

  it("reports the first notice as expired after its deadline", () => {
    expect(
      getListingRequestNoticeClockState(
        [baseNotice],
        new Date("2026-09-08T00:00:01.000Z")
      )
    ).toEqual({ state: "first_notice_expired", expiresAt: baseNotice.expires_at });
  });

  it("reports answered when the latest notice has an answered_at", () => {
    expect(
      getListingRequestNoticeClockState([
        { ...baseNotice, answered_at: "2026-09-03T00:00:00.000Z" },
      ])
    ).toEqual({ state: "answered", answeredAt: "2026-09-03T00:00:00.000Z" });
  });

  it("uses only the most recent notice when several exist", () => {
    const finalNotice: ListingRequestNotice = {
      ...baseNotice,
      id: "notice-2",
      notice_type: "final",
      sent_at: "2026-09-08T00:00:00.000Z",
      expires_at: "2026-09-15T00:00:00.000Z",
    };

    expect(
      getListingRequestNoticeClockState(
        [baseNotice, finalNotice],
        new Date("2026-09-10T00:00:00.000Z")
      )
    ).toEqual({ state: "final_notice_waiting", expiresAt: finalNotice.expires_at });
  });
});
