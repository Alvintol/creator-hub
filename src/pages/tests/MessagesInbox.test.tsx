import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessagesInbox from "../messages/MessagesInbox";

const mocks = vi.hoisted(() => ({
  useMessagesInbox: vi.fn(),
  useMyModerationReports: vi.fn(),
}));

vi.mock("../../hooks/conversations/useMessagesInbox", () => ({
  useMessagesInbox: mocks.useMessagesInbox,
}));

vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: mocks.useMyModerationReports,
}));

const createInboxItem = () => ({
  viewerRole: "buyer",
  hasUnread: true,
  unreadCount: 2,
  otherParticipantUserId: "creator-1",
  otherParticipant: {
    user_id: "creator-1",
    handle: "creatoruser",
    display_name: "Creator User",
    avatar_url: null,
  },
  listing: {
    id: "listing-1",
    title: "Custom Emote Pack",
  },
  conversation: {
    id: "conversation-1",
    conversation_type: "listing_inquiry",
    listing_request_id: null,
    subject: "Question about emotes",
    initiation_reason_code: "availability",
    status: "open",
    updated_at: "2026-05-09T12:00:00.000Z",
    last_message_at: "2026-05-09T12:00:00.000Z",
    last_message_preview: "Can you make these in my style?",
    last_message_sender_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    creator_user_id: "creator-1",
  },
});

const createReport = (overrides = {}) => ({
  id: "report-1",
  resolved_at: null,
  has_unread_update: false,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MessagesInbox />
    </MemoryRouter>
  );

describe("<MessagesInbox />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useMessagesInbox.mockReturnValue({
      data: {
        items: [],
        totalUnreadCount: 0,
      },
      isLoading: false,
      error: null,
    });

    mocks.useMyModerationReports.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it("shows the My reports moderation link above messages", () => {
    renderPage();

    expect(screen.getByText("Moderation reports")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track reports you have submitted and check review updates from admins."
      )
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "My reports" });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/settings/reports");
  });

  it("shows zero active reports when all reports are resolved or absent", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          id: "report-1",
          resolved_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("0 active reports")).toBeInTheDocument();
  });

  it("shows the active report count", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({ id: "report-1", resolved_at: null }),
        createReport({ id: "report-2", resolved_at: null }),
        createReport({
          id: "report-3",
          resolved_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("2 active reports")).toBeInTheDocument();
  });

  it("shows the singular active report count", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [createReport({ id: "report-1", resolved_at: null })],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("1 active report")).toBeInTheDocument();
  });

  it("shows the report count loading state", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Checking reports…")).toBeInTheDocument();
  });

  it("still renders the message summary and conversations", () => {
    mocks.useMessagesInbox.mockReturnValue({
      data: {
        items: [createInboxItem()],
        totalUnreadCount: 2,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText(/@creatoruser/)).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Open conversation" })
    ).toHaveAttribute("href", "/messages/conversation-1");
  });

  it("shows the unread report update count", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({ id: "report-1", has_unread_update: true }),
        createReport({ id: "report-2", has_unread_update: true }),
        createReport({ id: "report-3", has_unread_update: false }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("2 new report updates")).toBeInTheDocument();
  });
});