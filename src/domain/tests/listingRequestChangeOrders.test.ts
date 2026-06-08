import { describe, expect, it } from "vitest";

import {
  canBuyerRespondToListingRequestChangeOrder,
  canSendListingRequestChangeOrder,
  getListingRequestChangeOrderImpactLabels,
  getListingRequestChangeOrderStatusLabel,
  getListingRequestChangeOrderStatusSummary,
  getListingRequestChangeOrderStatusTone,
  hasListingRequestChangeOrderImpact,
  isListingRequestChangeOrderBuyerVisible,
} from "../listings/listingRequestChangeOrders";

describe("listing request change orders", () => {
  it("maps change-order statuses to display labels", () => {
    expect(
      getListingRequestChangeOrderStatusLabel("draft")
    ).toBe("Draft");

    expect(
      getListingRequestChangeOrderStatusLabel("sent")
    ).toBe("Awaiting buyer review");

    expect(
      getListingRequestChangeOrderStatusLabel("buyer_accepted")
    ).toBe("Accepted by buyer");

    expect(
      getListingRequestChangeOrderStatusLabel("buyer_declined")
    ).toBe("Declined by buyer");

    expect(
      getListingRequestChangeOrderStatusLabel("cancelled")
    ).toBe("Cancelled");

    expect(
      getListingRequestChangeOrderStatusLabel("superseded")
    ).toBe("Superseded");
  });

  it("returns useful summaries and tones", () => {
    expect(
      getListingRequestChangeOrderStatusSummary("sent")
    ).toContain("buyer must review");

    expect(
      getListingRequestChangeOrderStatusTone("sent")
    ).toBe("review");

    expect(
      getListingRequestChangeOrderStatusTone("buyer_accepted")
    ).toBe("success");

    expect(
      getListingRequestChangeOrderStatusTone("buyer_declined")
    ).toBe("danger");

    expect(
      getListingRequestChangeOrderStatusTone("draft")
    ).toBe("muted");
  });

  it("only allows draft change orders to be sent", () => {
    expect(
      canSendListingRequestChangeOrder("draft")
    ).toBe(true);

    expect(
      canSendListingRequestChangeOrder("sent")
    ).toBe(false);

    expect(
      canSendListingRequestChangeOrder("buyer_accepted")
    ).toBe(false);
  });

  it("only allows buyers to respond to sent change orders", () => {
    expect(
      canBuyerRespondToListingRequestChangeOrder("sent")
    ).toBe(true);

    expect(
      canBuyerRespondToListingRequestChangeOrder("draft")
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestChangeOrder(
        "buyer_accepted"
      )
    ).toBe(false);
  });

  it("keeps unsent drafts hidden from buyers", () => {
    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "draft",
        sentAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "cancelled",
        sentAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "sent",
        sentAt: "2026-06-08T12:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "buyer_declined",
        sentAt: "2026-06-08T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("requires at least one material project impact", () => {
    expect(
      hasListingRequestChangeOrderImpact({})
    ).toBe(false);

    expect(
      hasListingRequestChangeOrderImpact({
        changesTimeline: true,
      })
    ).toBe(true);

    expect(
      hasListingRequestChangeOrderImpact({
        changesMilestones: true,
      })
    ).toBe(true);
  });

  it("returns the selected impact labels in a stable order", () => {
    expect(
      getListingRequestChangeOrderImpactLabels({
        changesScope: true,
        changesTimeline: true,
        changesPaymentSchedule: true,
        changesMilestones: true,
      })
    ).toEqual([
      "Scope",
      "Timeline",
      "Payment schedule",
      "Milestones",
    ]);
  });
});