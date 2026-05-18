import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminRequests from "../admin/AdminRequests";

const mocks = vi.hoisted(() => ({
  useAdminRequests: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminRequests", () => ({
  useAdminRequests: mocks.useAdminRequests,
}));

const createRequestItem = (overrides = {}) => ({
  conversation: {
    id: "conversation-1",
    status: "active",
    last_message_at: null,
    last_message_sender_user_id: null,
    last_message_preview: null,
    buyer_image_upload_status: "not_allowed",
    updated_at: "2026-05-17T12:00:00.000Z",
  },
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
  request: {
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
    ...overrides,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminRequests />
    </MemoryRouter>
  );

describe("<AdminRequests />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAdminRequests.mockReturnValue({
      data: {
        items: [createRequestItem()],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      },
      isLoading: false,
      error: null,
    });
  });

  it("shows the structured request title while keeping listing context", () => {
    renderPage();

    expect(screen.getByText("Custom cozy emote pack")).toBeInTheDocument();
    expect(screen.getByText("Listing: Custom Emote Pack")).toBeInTheDocument();
    expect(
      screen.getByText("I need three cozy emotes for my Twitch channel launch.")
    ).toBeInTheDocument();

    expect(screen.getByText("Buyer: @buyeruser")).toBeInTheDocument();
    expect(screen.getByText("Creator: @creatoruser")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "View request" })).toHaveAttribute(
      "href",
      "/admin/requests/request-1"
    );
  });

  it("falls back to the listing title and legacy message for older requests", () => {
    mocks.useAdminRequests.mockReturnValue({
      data: {
        items: [
          createRequestItem({
            request_title: null,
            request_details: null,
            message: "Legacy request message.",
          }),
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Custom Emote Pack" })
    ).toBeInTheDocument();
    expect(screen.getByText("Legacy request message.")).toBeInTheDocument();
  });
});