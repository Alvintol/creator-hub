import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListingRequestAgreementBuilder from "../ListingRequestAgreementBuilder";
import type { ListingRequestRow } from "../../hooks/creatorRequests/useMyCreatorRequests";

const createRequest = (
  overrides?: Partial<ListingRequestRow>
): ListingRequestRow =>
  ({
    id: "request-123",
    listing_id: "listing-123",
    buyer_user_id: "buyer-123",
    creator_user_id: "creator-123",
    status: "accepted",
    message: "I need emotes.",
    creator_status_reason: null,
    listing_snapshot: {} as ListingRequestRow["listing_snapshot"],
    created_at: "2026-05-25T12:00:00.000Z",
    updated_at: "2026-05-25T12:00:00.000Z",
    request_title: "Emote pack",
    request_details: "A few channel emotes.",
    requested_timeline: null,
    budget_amount: null,
    reference_links: [],
    archived_at: null,
    archived_by_user_id: null,
    ...overrides,
  }) as ListingRequestRow;

const fillValidAgreementForm = () => {
  fireEvent.change(screen.getByLabelText("Scope summary"), {
    target: { value: "Create three custom emotes for the buyer." },
  });

  fireEvent.change(screen.getByLabelText("Included deliverables"), {
    target: { value: "Three PNG emotes\nTransparent exports" },
  });

  fireEvent.change(screen.getByLabelText("Required checklist items"), {
    target: { value: "Sketch approval\nFinal PNG delivery" },
  });

  fireEvent.change(screen.getByLabelText("Total amount"), {
    target: { value: "300" },
  });

  fireEvent.change(screen.getByLabelText("Deposit amount"), {
    target: { value: "100" },
  });

  fireEvent.change(screen.getByLabelText("Estimated completion date"), {
    target: { value: "2026-06-15" },
  });
};

describe("ListingRequestAgreementBuilder", () => {
  it("does not render unless the request is accepted", () => {
    const onCreateAgreement = vi.fn();

    render(
      <ListingRequestAgreementBuilder
        request={createRequest({ status: "submitted" })}
        onCreateAgreement={onCreateAgreement}
      />
    );

    expect(screen.queryByText("Create project agreement")).not.toBeInTheDocument();
  });

  it("creates and sends an agreement with valid defaults", () => {
    const onCreateAgreement = vi.fn();

    render(
      <ListingRequestAgreementBuilder
        request={createRequest()}
        onCreateAgreement={onCreateAgreement}
      />
    );

    fillValidAgreementForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Create and send agreement" })
    );

    expect(onCreateAgreement).toHaveBeenCalledTimes(1);
    expect(onCreateAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        listingRequestId: "request-123",
        status: "sent",
        paymentStructure: "deposit_balance",
        startingPaymentStatus: "payment_required",
        currency: "cad",
        baseAmount: 300,
        totalAmount: 300,
        depositAmount: 100,
        estimatedStartAt: null,
        estimatedCompletionAt: "2026-06-15T12:00:00.000Z",
        lateDeliveryGraceDays: 3,
        includedRevisionCount: 2,
        minimumUpdateRule: expect.objectContaining({
          rule: "weekly_updates",
        }),
        scopeSummary: "Create three custom emotes for the buyer.",
        includedDeliverables: ["Three PNG emotes", "Transparent exports"],
        additionalCostPolicy: expect.stringContaining(
          "accepted change order"
        ),
        revisionPolicy: expect.stringContaining("revision rounds"),
        updateScheduleSummary: expect.stringContaining("weekly progress updates"),
        items: [
          expect.objectContaining({
            title: "Sketch approval",
            item_type: "included",
            price_amount: null,
            timeline_impact_days: 0,
            payment_timing: "included_no_extra_charge",
            is_required: true,
            is_selected: true,
            sort_order: 0,
          }),
          expect.objectContaining({
            title: "Final PNG delivery",
            item_type: "included",
            payment_timing: "included_no_extra_charge",
            sort_order: 1,
          }),
        ],
        paymentScheduleItems: [
          expect.objectContaining({
            title: "Project deposit",
            amount: 100,
            currency: "cad",
            payment_timing: "due_before_work_starts",
            status: "payment_required",
            due_at: null,
            sort_order: 0,
          }),
          expect.objectContaining({
            title: "Remaining balance",
            amount: 200,
            currency: "cad",
            payment_timing: "due_before_final_release",
            status: "pending",
            due_at: null,
            sort_order: 1,
          }),
        ],
      })
    );
  });

  it("saves a draft when send now is unchecked", () => {
    const onCreateAgreement = vi.fn();

    render(
      <ListingRequestAgreementBuilder
        request={createRequest()}
        onCreateAgreement={onCreateAgreement}
      />
    );

    fillValidAgreementForm();

    fireEvent.click(
      screen.getByLabelText("Send to buyer now. Uncheck to save as a draft.")
    );

    fireEvent.click(screen.getByRole("button", { name: "Save agreement draft" }));

    expect(onCreateAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
      })
    );
  });

  it("shows validation errors for missing required fields", () => {
    const onCreateAgreement = vi.fn();

    render(
      <ListingRequestAgreementBuilder
        request={createRequest()}
        onCreateAgreement={onCreateAgreement}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create and send agreement" })
    );

    expect(screen.getByText("Add a scope summary.")).toBeInTheDocument();
    expect(
      screen.getByText("Add at least one included deliverable.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add at least one required checklist item.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter a total amount greater than 0.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter a deposit amount greater than 0.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose an estimated completion date.")
    ).toBeInTheDocument();

    expect(onCreateAgreement).not.toHaveBeenCalled();
  });

  it("renders create error", () => {
    render(
      <ListingRequestAgreementBuilder
        request={createRequest()}
        error={new Error("Agreement RPC failed.")}
        onCreateAgreement={vi.fn()}
      />
    );

    expect(screen.getByText("Agreement RPC failed.")).toBeInTheDocument();
  });
});