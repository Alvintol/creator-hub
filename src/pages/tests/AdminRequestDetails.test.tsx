import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminRequestDetails from "../admin/AdminRequestDetails";

const mocks = vi.hoisted(() => ({
  useAdminRequest: vi.fn(),
  useListingRequestAgreement: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminRequest", () => ({
  useAdminRequest: mocks.useAdminRequest,
}));

vi.mock("../../components/RequestConversationThread", () => ({
  default: () => <div>Conversation thread loaded</div>,
}));

vi.mock("../../hooks/creatorRequests/useListingRequestAgreement", () => ({
  useListingRequestAgreement: mocks.useListingRequestAgreement,
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/requests/request-1"]}>
      <Routes>
        <Route path="/admin/requests/:id" element={<AdminRequestDetails />} />
      </Routes>
    </MemoryRouter>
  );

describe("<AdminRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAdminRequest.mockReturnValue({
      data: {
        request,
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
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
    
    mocks.useListingRequestAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it("renders structured request details for admin review", () => {
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

    expect(screen.getByText("@buyeruser")).toBeInTheDocument();
    expect(screen.getByText("@creatoruser")).toBeInTheDocument();
    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });
});