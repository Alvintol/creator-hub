import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BuyerRequestDetails from "../buyer/BuyerRequestDetails";

const mocks = vi.hoisted(() => ({
  useBuyerRequest: vi.fn(),
  archiveRequest: vi.fn(),
  useListingRequestAgreement: vi.fn(),
  respondAgreement: vi.fn(),
}));

vi.mock("../../hooks/creatorRequests/useBuyerRequest", () => ({
  useBuyerRequest: mocks.useBuyerRequest,
}));

vi.mock("../../components/RequestConversationThread", () => ({
  default: () => <div>Conversation thread loaded</div>,
}));

vi.mock("../../hooks/creatorRequests/useArchiveBuyerListingRequest", () => ({
  useArchiveBuyerListingRequest: () => ({
    mutateAsync: mocks.archiveRequest,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/creatorRequests/useListingRequestAgreement", () => ({
  useListingRequestAgreement: mocks.useListingRequestAgreement,
}));

vi.mock("../../hooks/creatorRequests/useRespondListingRequestAgreement", () => ({
  useRespondListingRequestAgreement: () => ({
    mutateAsync: mocks.respondAgreement,
    isPending: false,
    error: null,
  }),
}));

const request = {
  id: "request-1",
  listing_id: "listing-1",
  buyer_user_id: "buyer-1",
  creator_user_id: "creator-1",
  status: "submitted",
  message: "Legacy request message.",
  request_title: "Custom cozy emote pack",
  request_details: "I need three cozy emotes for my Twitch channel launch.",
  requested_timeline: "Flexible, ideally before June 10.",
  budget_amount: 75,
  reference_links: ["https://example.com/reference"],
  creator_status_reason: null,
  created_at: "2026-05-17T12:00:00.000Z",
  updated_at: "2026-05-17T12:00:00.000Z",
  archived_at: null,
  archived_by_user_id: null,
  listing_snapshot: {
    listing_id: "listing-1",
    creator_user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    offering_type: "commission",
    category: "emotes",
    video_subtype: null,
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    deliverables: ["3 emotes", "PNG files"],
    tags: ["emotes"],
    preview_url: null,
    fulfilment_mode: "request",
    status: "published",
    is_active: true,
    updated_at: "2026-05-09T12:00:00.000Z",
  },
};

const agreement = {
  id: "agreement-1",
  listing_request_id: "request-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  version_number: 1,
  status: "sent",
  payment_structure: "deposit_balance",
  starting_payment_status: "payment_required",
  currency: "cad",
  base_amount: 200,
  total_amount: 250,
  deposit_amount: 100,
  estimated_start_at: "2026-06-01T12:00:00.000Z",
  estimated_completion_at: "2026-06-15T12:00:00.000Z",
  adjusted_estimated_completion_at: "2026-06-17T12:00:00.000Z",
  late_delivery_grace_days: 7,
  included_revision_count: 2,
  minimum_update_rule: "weekly_updates",
  first_update_due_days: 5,
  update_frequency_days: 7,
  scope_summary: "Create a custom overlay package for the buyer.",
  included_deliverables: ["Starting soon screen", "BRB screen"],
  additional_cost_policy:
    "Additional animated screens require an accepted change order.",
  revision_policy: "Includes two revision passes.",
  update_schedule_summary:
    "First update within 5 days, then weekly until delivery.",
  sent_at: "2026-05-24T12:00:00.000Z",
  buyer_accepted_at: null,
  buyer_declined_at: null,
  superseded_at: null,
  cancelled_at: null,
  created_at: "2026-05-24T12:00:00.000Z",
  updated_at: "2026-05-24T12:00:00.000Z",
  listing_request_agreement_acknowledgements: [],
  listing_request_agreement_items: [
    {
      id: "item-1",
      agreement_id: "agreement-1",
      title: "Starting soon screen",
      description: "Static starting soon scene.",
      item_type: "included",
      price_amount: 0,
      timeline_impact_days: 0,
      payment_timing: "included_no_extra_charge",
      is_required: true,
      is_selected: true,
      sort_order: 0,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
    },
  ],
  listing_request_payment_schedule_items: [
    {
      id: "payment-1",
      agreement_id: "agreement-1",
      title: "Deposit",
      description: "Required before work starts.",
      amount: 100,
      currency: "cad",
      payment_timing: "due_before_work_starts",
      status: "payment_required",
      due_at: null,
      paid_at: null,
      sort_order: 0,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
    },
  ],
  listing_request_timeline_holds: [],
} as const;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/requests/request-1"]}>
      <Routes>
        <Route path="/requests/:id" element={<BuyerRequestDetails />} />
      </Routes>
    </MemoryRouter>
  );

describe("<BuyerRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request,
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.archiveRequest.mockResolvedValue("request-1");

    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    mocks.respondAgreement.mockResolvedValue({
      id: "agreement-1",
      status: "buyer_accepted",
      starting_payment_status: "payment_required",
    });
  });

  it("renders structured buyer request details", () => {
    renderPage();

    expect(screen.getByText("Custom cozy emote pack")).toBeInTheDocument();
    expect(
      screen.getByText("I need three cozy emotes for my Twitch channel launch.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Flexible, ideally before June 10.")
    ).toBeInTheDocument();
    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/reference")).toHaveAttribute(
      "href",
      "https://example.com/reference"
    );

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });

  it("asks for confirmation before archiving a submitted request", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Archive request" }));

    expect(
      screen.getByText(
        "Are you sure you want to archive this request? The creator will no longer see it as an active request."
      )
    ).toBeInTheDocument();

    expect(mocks.archiveRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => {
      expect(mocks.archiveRequest).toHaveBeenCalledWith({
        requestId: "request-1",
      });
    });
  });

  it("lets the buyer cancel archive confirmation", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Archive request" }));

    expect(screen.getByRole("button", { name: "Confirm archive" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep request" }));

    expect(
      screen.queryByRole("button", { name: "Confirm archive" })
    ).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Archive request" })).toBeInTheDocument();
  });

  it("lets the buyer accept a sent project agreement after checking all acknowledgements", async () => {
    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    renderPage();

    const acceptButton = screen.getByRole("button", {
      name: "Accept project agreement",
    });

    expect(acceptButton).toBeDisabled();

    screen.getAllByRole("checkbox").forEach((checkbox) => {
      fireEvent.click(checkbox);
    });

    expect(acceptButton).toBeEnabled();

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mocks.respondAgreement).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: [
          "agreement:scope_summary",
          "scope_item:item-1",
          "agreement:payment_schedule",
          "payment_item:payment-1",
          "agreement:timeline",
          "agreement:update_schedule",
          "agreement:revision_policy",
          "agreement:additional_cost_policy",
          "agreement:change_orders",
          "agreement:final_release_payment",
        ],
      });
    });
  });

  it("lets the buyer decline a sent project agreement without acknowledgements", async () => {
    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Decline agreement" }));

    await waitFor(() => {
      expect(mocks.respondAgreement).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        response: "buyer_declined",
      });
    });
  });
});