import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorRequestDetails from "../creator/CreatorRequestDetails";

const mocks = vi.hoisted(() => ({
  useCreatorRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock("../../hooks/creatorRequests/useCreatorRequest", () => ({
  useCreatorRequest: mocks.useCreatorRequest,
}));

vi.mock("../../hooks/creatorRequests/useUpdateCreatorListingRequestStatus", () => ({
  useUpdateCreatorListingRequestStatus: () => ({
    mutateAsync: mocks.updateRequestStatus,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../components/RequestConversationThread", () => ({
  default: () => <div>Conversation thread loaded</div>,
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
    <MemoryRouter initialEntries={["/creator/requests/request-1"]}>
      <Routes>
        <Route
          path="/creator/requests/:id"
          element={<CreatorRequestDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("<CreatorRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request,
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.updateRequestStatus.mockResolvedValue(undefined);
  });

  it("renders structured buyer request details for the creator", () => {
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
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });
});