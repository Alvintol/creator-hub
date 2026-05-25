import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListingRequestAgreementCreatorActions from "../ListingRequestAgreementCreatorActions";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";

const createAgreement = (
  overrides?: Partial<ListingRequestAgreementRow>
): ListingRequestAgreementRow =>
  ({
    id: "agreement-1",
    listing_request_id: "request-1",
    creator_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    version_number: 1,
    status: "draft",
    payment_structure: "deposit_balance",
    starting_payment_status: "payment_required",
    currency: "cad",
    base_amount: 300,
    total_amount: 300,
    deposit_amount: 100,
    estimated_start_at: null,
    estimated_completion_at: "2026-06-15T12:00:00.000Z",
    adjusted_estimated_completion_at: "2026-06-15T12:00:00.000Z",
    late_delivery_grace_days: 3,
    included_revision_count: 2,
    minimum_update_rule: "weekly_updates",
    first_update_due_days: 5,
    update_frequency_days: 7,
    scope_summary: "Create three custom emotes.",
    included_deliverables: ["Three PNG emotes"],
    additional_cost_policy: "Changes require an accepted change order.",
    revision_policy: "Two included revisions.",
    update_schedule_summary: "Weekly updates required.",
    sent_at: null,
    buyer_accepted_at: null,
    buyer_declined_at: null,
    superseded_at: null,
    cancelled_at: null,
    created_at: "2026-05-25T12:00:00.000Z",
    updated_at: "2026-05-25T12:00:00.000Z",
    listing_request_agreement_items: [],
    listing_request_payment_schedule_items: [],
    listing_request_timeline_holds: [],
    listing_request_agreement_acknowledgements: [],
    ...overrides,
  }) as ListingRequestAgreementRow;

describe("ListingRequestAgreementCreatorActions", () => {
  it("does not render when there is no agreement", () => {
    render(
      <ListingRequestAgreementCreatorActions
        agreement={null}
        onSendAgreement={vi.fn()}
      />
    );

    expect(screen.queryByText("Project agreement actions")).not.toBeInTheDocument();
  });

  it("does not render for a sent agreement", () => {
    render(
      <ListingRequestAgreementCreatorActions
        agreement={createAgreement({ status: "sent" })}
        onSendAgreement={vi.fn()}
      />
    );

    expect(screen.queryByText("Project agreement actions")).not.toBeInTheDocument();
  });

  it("renders a send draft action for a draft agreement", () => {
    render(
      <ListingRequestAgreementCreatorActions
        agreement={createAgreement()}
        onSendAgreement={vi.fn()}
      />
    );

    expect(screen.getByText("Project agreement actions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send draft to buyer" })
    ).toBeInTheDocument();
  });

  it("calls onSendAgreement with the draft agreement id", () => {
    const onSendAgreement = vi.fn();

    render(
      <ListingRequestAgreementCreatorActions
        agreement={createAgreement()}
        onSendAgreement={onSendAgreement}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send draft to buyer" }));

    expect(onSendAgreement).toHaveBeenCalledWith("agreement-1");
  });

  it("disables the send action while pending", () => {
    render(
      <ListingRequestAgreementCreatorActions
        agreement={createAgreement()}
        isPending
        onSendAgreement={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Sending agreement…" })
    ).toBeDisabled();
  });

  it("renders send errors", () => {
    render(
      <ListingRequestAgreementCreatorActions
        agreement={createAgreement()}
        error={new Error("Draft could not be sent.")}
        onSendAgreement={vi.fn()}
      />
    );

    expect(screen.getByText("Draft could not be sent.")).toBeInTheDocument();
  });
});