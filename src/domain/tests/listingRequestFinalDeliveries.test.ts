import { describe, expect, it } from "vitest";

import {
  canBuyerRespondToListingRequestFinalDelivery,
  canCreateNextListingRequestFinalDelivery,
  canSubmitListingRequestFinalDelivery,
  getListingRequestFinalDeliveryStatusLabel,
  getListingRequestFinalDeliveryStatusSummary,
  getListingRequestFinalDeliveryStatusTone,
  hasListingRequestFinalDeliveryContent,
  isListingRequestFinalDeliveryBuyerVisible,
} from "../listings/listingRequestFinalDeliveries";

describe("listing request final deliveries", () => {
  it("maps delivery statuses to display labels", () => {
    expect(
      getListingRequestFinalDeliveryStatusLabel("draft")
    ).toBe("Draft");

    expect(
      getListingRequestFinalDeliveryStatusLabel("submitted")
    ).toBe("Awaiting buyer review");

    expect(
      getListingRequestFinalDeliveryStatusLabel(
        "revision_requested"
      )
    ).toBe("Revision requested");

    expect(
      getListingRequestFinalDeliveryStatusLabel(
        "buyer_approved"
      )
    ).toBe("Approved by buyer");

    expect(
      getListingRequestFinalDeliveryStatusLabel("cancelled")
    ).toBe("Cancelled");

    expect(
      getListingRequestFinalDeliveryStatusLabel("superseded")
    ).toBe("Superseded");
  });

  it("returns useful delivery summaries and tones", () => {
    expect(
      getListingRequestFinalDeliveryStatusSummary("submitted")
    ).toContain("buyer review");

    expect(
      getListingRequestFinalDeliveryStatusTone("submitted")
    ).toBe("review");

    expect(
      getListingRequestFinalDeliveryStatusTone(
        "buyer_approved"
      )
    ).toBe("success");

    expect(
      getListingRequestFinalDeliveryStatusTone(
        "revision_requested"
      )
    ).toBe("danger");

    expect(
      getListingRequestFinalDeliveryStatusTone("draft")
    ).toBe("muted");
  });

  it("only allows draft deliveries to be submitted", () => {
    expect(
      canSubmitListingRequestFinalDelivery("draft")
    ).toBe(true);

    expect(
      canSubmitListingRequestFinalDelivery("submitted")
    ).toBe(false);

    expect(
      canSubmitListingRequestFinalDelivery(
        "revision_requested"
      )
    ).toBe(false);
  });

  it("only allows buyers to respond to submitted deliveries", () => {
    expect(
      canBuyerRespondToListingRequestFinalDelivery(
        "submitted"
      )
    ).toBe(true);

    expect(
      canBuyerRespondToListingRequestFinalDelivery("draft")
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestFinalDelivery(
        "buyer_approved"
      )
    ).toBe(false);
  });

  it("allows a new delivery after revision or cancellation", () => {
    expect(
      canCreateNextListingRequestFinalDelivery(null)
    ).toBe(true);

    expect(
      canCreateNextListingRequestFinalDelivery(
        "revision_requested"
      )
    ).toBe(true);

    expect(
      canCreateNextListingRequestFinalDelivery("cancelled")
    ).toBe(true);

    expect(
      canCreateNextListingRequestFinalDelivery("submitted")
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        "buyer_approved"
      )
    ).toBe(false);
  });

  it("keeps unsent drafts hidden from buyers", () => {
    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "draft",
        submittedAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "submitted",
        submittedAt: "2026-06-09T12:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "revision_requested",
        submittedAt: "2026-06-09T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("requires a summary or at least one delivery link", () => {
    expect(
      hasListingRequestFinalDeliveryContent({})
    ).toBe(false);

    expect(
      hasListingRequestFinalDeliveryContent({
        summary: "Final delivery is ready.",
      })
    ).toBe(true);

    expect(
      hasListingRequestFinalDeliveryContent({
        deliveryLinks: [
          "",
          "https://example.com/final-delivery",
        ],
      })
    ).toBe(true);
  });
});