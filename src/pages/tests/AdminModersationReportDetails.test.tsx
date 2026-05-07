import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminModerationReportDetails from "../admin/AdminModerationReportDetails";

const mocks = vi.hoisted(() => ({
  useAdminModerationReport: vi.fn(),
  lockConversation: vi.fn(),
  reopenConversation: vi.fn(),
  updateReportStatus: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminModerationReport", () => ({
  useAdminModerationReport: mocks.useAdminModerationReport,
}));

vi.mock("../../hooks/admin/useAdminConversationModerationActions", () => ({
  useAdminLockConversation: () => ({
    mutateAsync: mocks.lockConversation,
    isPending: false,
  }),
  useAdminReopenConversation: () => ({
    mutateAsync: mocks.reopenConversation,
    isPending: false,
  }),
}));

vi.mock("../../hooks/admin/useUpdateModerationReportStatus", () => ({
  useUpdateModerationReportStatus: () => ({
    mutateAsync: mocks.updateReportStatus,
    isPending: false,
    error: null,
  }),
}));

type ConversationStatus = "open" | "admin_locked" | "closed";

const createReportData = (conversationStatus: ConversationStatus) => ({
  report: {
    id: "report-1",
    target_type: "conversation",
    conversation_id: "conversation-1",
    message_id: null,
    listing_id: null,
    profile_user_id: null,
    reporter_user_id: "reporter-1",
    reported_user_id: "reported-1",
    reason_code: "harassment",
    reason_details: "The reported user was hostile in the thread.",
    status: "submitted",
    reporter_status_message: null,
    reporter_status_updated_at: null,
    resolution_code: null,
    resolved_at: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    admin_notes: null,
    created_at: "2026-05-07T12:00:00.000Z",
  },
  conversation: {
    id: "conversation-1",
    conversation_type: "creator_inquiry",
    subject: "Custom emote inquiry",
    listing_id: null,
    listing_request_id: null,
    status: conversationStatus,
    last_message_at: "2026-05-07T12:05:00.000Z",
    last_message_preview: "Can you make this in my style?",
    created_at: "2026-05-07T12:00:00.000Z",
    updated_at: "2026-05-07T12:05:00.000Z",
  },
  messages: [],
  listing: null,
  reporter: {
    user_id: "reporter-1",
    handle: "clientuser",
    display_name: "Client User",
    avatar_url: null,
  },
  reportedUser: {
    user_id: "reported-1",
    handle: "creatoruser",
    display_name: "Creator User",
    avatar_url: null,
  },
  profilesByUserId: {
    "reporter-1": {
      user_id: "reporter-1",
      handle: "clientuser",
      display_name: "Client User",
      avatar_url: null,
    },
    "reported-1": {
      user_id: "reported-1",
      handle: "creatoruser",
      display_name: "Creator User",
      avatar_url: null,
    },
  },
  updates: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/reports/report-1"]}>
      <Routes>
        <Route
          path="/admin/reports/:id"
          element={<AdminModerationReportDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("<AdminModerationReportDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.lockConversation.mockResolvedValue({
      conversation_id: "conversation-1",
      previous_status: "open",
      new_status: "admin_locked",
      changed: true,
    });

    mocks.reopenConversation.mockResolvedValue({
      conversation_id: "conversation-1",
      previous_status: "admin_locked",
      new_status: "open",
      changed: true,
    });

    mocks.updateReportStatus.mockResolvedValue({});
  });

  it("shows the lock action for open conversations", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("open"),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Conversation moderation")).toBeInTheDocument();
    expect(screen.getByText("Current status:")).toBeInTheDocument();
    expect(screen.getByText("Current status:").closest("p")).toHaveTextContent(
      "open"
    );
    expect(
      screen.getByRole("button", { name: "Lock conversation" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Reopen conversation" })
    ).not.toBeInTheDocument();
  });

  it("locks an open conversation through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("open"),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Lock conversation" }));

    await waitFor(() => {
      expect(mocks.lockConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Conversation locked by admin.")
    ).toBeInTheDocument();
  });

  it("shows the reopen action for admin-locked conversations", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("admin_locked"),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Conversation moderation")).toBeInTheDocument();
    expect(screen.getByText("Current status:").closest("p")).toHaveTextContent(
      "admin_locked"
    );
    expect(
      screen.getByRole("button", { name: "Reopen conversation" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Lock conversation" })
    ).not.toBeInTheDocument();
  });

  it("reopens an admin-locked conversation through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("admin_locked"),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Reopen conversation" }));

    await waitFor(() => {
      expect(mocks.reopenConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Admin lock removed. Conversation reopened.")
    ).toBeInTheDocument();
  });

  it("disables locking for conversations that are already closed", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("closed"),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Current status:").closest("p")).toHaveTextContent(
      "closed"
    );
    expect(
      screen.getByRole("button", { name: "Lock conversation" })
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Only open conversations can be admin locked. Already closed conversations remain available for review."
      )
    ).toBeInTheDocument();
  });

  it("shows a useful error when locking fails", async () => {
    mocks.lockConversation.mockRejectedValue(
      new Error("Only open conversations can be admin locked.")
    );

    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData("open"),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Lock conversation" }));

    expect(
      await screen.findByText("Only open conversations can be admin locked.")
    ).toBeInTheDocument();
  });
});