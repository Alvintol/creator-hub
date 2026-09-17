import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListingRequestAgreementSummary from "../listingRequests/agreements/ListingRequestAgreementSummary";
import ListingRequestMilestoneSummary from "../listingRequests/milestones/ListingRequestMilestoneSummary";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";
import type { ListingRequestMilestoneRow } from "../../hooks/creatorRequests/useListingRequestMilestones";

const acknowledgement = (id: string, label: string, createdAt: string) => ({
  id,
  agreement_id: "agreement-1",
  buyer_user_id: "buyer-1",
  acknowledgement_key: `agreement:${id}`,
  acknowledgement_label: label,
  created_at: createdAt,
});

const agreement = {
  id: "agreement-1",
  listing_request_id: "request-1",
  status: "buyer_accepted",
  version_number: 1,
  payment_structure: "full_upfront",
  starting_payment_status: "paid",
  total_amount: 300,
  deposit_amount: null,
  currency: "cad",
  scope_summary: "Stream overlay package.",
  included_deliverables: [],
  included_revision_count: 2,
  additional_cost_policy: "",
  revision_policy: "",
  update_schedule_summary: "",
  estimated_completion_at: null,
  adjusted_estimated_completion_at: null,
  listing_request_agreement_items: [],
  listing_request_payment_schedule_items: [],
  listing_request_timeline_holds: [],
  listing_request_agreement_acknowledgements: [
    acknowledgement("scope", "I understand the scope.", "2026-05-24T12:00:00.000Z"),
    acknowledgement("payments", "I understand the payments.", "2026-05-24T12:01:00.000Z"),
    acknowledgement("timeline", "I understand the timeline.", "2026-05-24T12:02:00.000Z"),
    acknowledgement("change", "I understand change orders.", "2026-06-02T09:00:00.000Z"),
  ],
} as unknown as ListingRequestAgreementRow;

const milestone = (
  overrides: Partial<ListingRequestMilestoneRow>
): ListingRequestMilestoneRow =>
  ({
    id: "milestone-1",
    listing_request_id: "request-1",
    agreement_id: "agreement-1",
    status: "pending",
    title: "Milestone",
    description: "Milestone description.",
    amount: 100,
    currency: "cad",
    sort_order: 0,
    submission_version: 0,
    created_at: "2026-06-16T12:00:00.000Z",
    updated_at: "2026-06-16T12:00:00.000Z",
    ...overrides,
  }) as ListingRequestMilestoneRow;

describe("buyer confirmation grouping", () => {
  it("lists confirmations from the same day under one date", () => {
    render(<ListingRequestAgreementSummary agreement={agreement} />);

    const dates = screen.getAllByText(/^Confirmed on /);

    expect(dates).toHaveLength(2);

    const firstGroup = dates[0].parentElement as HTMLElement;

    expect(within(firstGroup).getAllByRole("listitem")).toHaveLength(3);
    expect(within(firstGroup).getByText("I understand the timeline.")).toBeInTheDocument();
    expect(
      within(dates[1].parentElement as HTMLElement).getByText("I understand change orders.")
    ).toBeInTheDocument();
  });
});

describe("milestone rows", () => {
  const milestones = [
    milestone({ id: "m1", sort_order: 0, title: "Sketches", status: "paid" }),
    milestone({ id: "m2", sort_order: 1, title: "Line art", status: "submitted" }),
    milestone({ id: "m3", sort_order: 2, title: "Colour", status: "pending" }),
  ];

  const renderRows = () =>
    render(
      <ListingRequestMilestoneSummary
        milestones={milestones}
        submissions={[]}
        viewer="buyer"
        isLoading={false}
        error={null}
      />
    );

  it("collapses finished milestones and opens the active one", () => {
    renderRows();

    expect(screen.getByRole("button", { name: /Sketches/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: /Line art/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("button", { name: /Colour/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("expands a finished milestone on demand", () => {
    renderRows();

    const toggle = screen.getByRole("button", { name: /Sketches/ });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
