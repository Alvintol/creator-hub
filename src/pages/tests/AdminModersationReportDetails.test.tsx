import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminModerationReportDetails from "../admin/AdminModerationReportDetails";

const mocks = vi.hoisted(() => ({
  useAdminModerationReport: vi.fn(),
  lockConversation: vi.fn(),
  reopenConversation: vi.fn(),
  updateReportStatus: vi.fn(),
  hideListing: vi.fn(),
  restoreListing: vi.fn(),
  markProfileUnderReview: vi.fn(),
  clearProfileReviewFlag: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminProfileModerationActions", () => ({
  useAdminMarkProfileUnderReview: () => ({
    mutateAsync: mocks.markProfileUnderReview,
    isPending: false,
  }),
  useAdminClearProfileReviewFlag: () => ({
    mutateAsync: mocks.clearProfileReviewFlag,
    isPending: false,
  }),
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

vi.mock("../../hooks/admin/useAdminListingModerationActions", () => ({
  useAdminHideListing: () => ({
    mutateAsync: mocks.hideListing,
    isPending: false,
  }),
  useAdminRestoreListing: () => ({
    mutateAsync: mocks.restoreListing,
    isPending: false,
  }),
}));

type ConversationStatus = "open" | "admin_locked" | "closed";

type ReportDataOptions = {
  conversationStatus?: ConversationStatus;
  profileReport?: boolean;
  profileModerationState?: {
    isUnderReview: boolean;
  } | null;
  profileModerationActions?: Array<{
    id: string;
    actionType: "under_review" | "review_cleared";
    previousIsUnderReview: boolean;
    newIsUnderReview: boolean;
    adminNote?: string | null;
  }>;
  reporterStatusUpdatedAt?: string | null;
  reporterSeenAt?: string | null;
  listing?: {
    status: string;
    isActive: boolean;
    adminHiddenAt?: string | null;
    adminHiddenByUserId?: string | null;
    adminHiddenReportId?: string | null;
  } | null;
  listingModerationActions?: Array<{
    id: string;
    actionType: "admin_hidden" | "admin_restored";
    previousIsActive: boolean;
    newIsActive: boolean;
    adminNote?: string | null;
  }>;
};

const createReportData = ({
  conversationStatus = "open",
  profileReport = false,
  profileModerationState = null,
  profileModerationActions = [],
  listing = null,
  listingModerationActions = [],
  reporterStatusUpdatedAt = null,
  reporterSeenAt = null,
}: ReportDataOptions = {}) => ({
  report: {
    id: "report-1",
    target_type: profileReport ? "profile" : listing ? "listing" : "conversation",
    conversation_id: listing || profileReport ? null : "conversation-1",
    message_id: null,
    listing_id: listing ? "listing-1" : null,
    profile_user_id: profileReport ? "reported-1" : null,
    reporter_user_id: "reporter-1",
    reported_user_id: "reported-1",
    reason_code: "harassment",
    reason_details: "The reported user was hostile in the thread.",
    status: "submitted",
    reporter_status_message: reporterStatusUpdatedAt
      ? "Thanks. We are reviewing this report."
      : null,
    reporter_status_updated_at: reporterStatusUpdatedAt,
    reporter_seen_at: reporterSeenAt,
    resolution_code: null,
    resolved_at: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    admin_notes: null,
    created_at: "2026-05-07T12:00:00.000Z",
  },
  conversation: listing || profileReport
    ? null
    : {
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
  listing: listing
    ? {
      id: "listing-1",
      user_id: "reported-1",
      title: "Custom Emote Pack",
      status: listing.status,
      is_active: listing.isActive,
      created_at: "2026-05-07T12:00:00.000Z",
      updated_at: "2026-05-07T12:05:00.000Z",
      admin_hidden_at: listing.adminHiddenAt ?? null,
      admin_hidden_by_user_id: listing.adminHiddenByUserId ?? null,
      admin_hidden_report_id: listing.adminHiddenReportId ?? null,
    }
    : null,
  listingModerationActions: listingModerationActions.map((action) => ({
    id: action.id,
    moderation_report_id: "report-1",
    listing_id: "listing-1",
    admin_user_id: "admin-1",
    action_type: action.actionType,
    previous_status: "published",
    new_status: "published",
    previous_is_active: action.previousIsActive,
    new_is_active: action.newIsActive,
    admin_note: action.adminNote ?? null,
    created_at: "2026-05-07T12:10:00.000Z",
  })),
  profileModerationState: profileModerationState
    ? {
      profile_user_id: "reported-1",
      is_under_review: profileModerationState.isUnderReview,
      review_started_at: profileModerationState.isUnderReview
        ? "2026-05-08T12:10:00.000Z"
        : null,
      review_started_by_user_id: profileModerationState.isUnderReview
        ? "admin-1"
        : null,
      review_cleared_at: profileModerationState.isUnderReview
        ? null
        : "2026-05-08T12:20:00.000Z",
      review_cleared_by_user_id: profileModerationState.isUnderReview
        ? null
        : "admin-1",
      updated_at: "2026-05-08T12:20:00.000Z",
    }
    : null,
  profileModerationActions: profileModerationActions.map((action) => ({
    id: action.id,
    moderation_report_id: "report-1",
    profile_user_id: "reported-1",
    admin_user_id: "admin-1",
    action_type: action.actionType,
    previous_is_under_review: action.previousIsUnderReview,
    new_is_under_review: action.newIsUnderReview,
    admin_note: action.adminNote ?? null,
    created_at: "2026-05-08T12:10:00.000Z",
  })),
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
    "admin-1": {
      user_id: "admin-1",
      handle: "adminuser",
      display_name: "Admin User",
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

    mocks.hideListing.mockResolvedValue({
      listing_id: "listing-1",
      previous_status: "published",
      new_status: "published",
      previous_is_active: true,
      new_is_active: false,
      changed: true,
    });

    mocks.restoreListing.mockResolvedValue({
      listing_id: "listing-1",
      previous_status: "published",
      new_status: "published",
      previous_is_active: false,
      new_is_active: true,
      changed: true,
    });

    mocks.markProfileUnderReview.mockResolvedValue({
      profile_user_id: "reported-1",
      previous_is_under_review: false,
      new_is_under_review: true,
      changed: true,
    });

    mocks.clearProfileReviewFlag.mockResolvedValue({
      profile_user_id: "reported-1",
      previous_is_under_review: true,
      new_is_under_review: false,
      changed: true,
    });
  });

  it("shows the lock action for open conversations", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({ conversationStatus: "open" }),
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
      data: createReportData({ conversationStatus: "open" }),
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
      data: createReportData({ conversationStatus: "admin_locked" }),
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
      data: createReportData({ conversationStatus: "admin_locked" }),
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
      data: createReportData({ conversationStatus: "closed" }),
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
      data: createReportData({ conversationStatus: "open" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Lock conversation" }));

    expect(
      await screen.findByText("Only open conversations can be admin locked.")
    ).toBeInTheDocument();
  });

  it("shows the hide action for visible listings", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Listing moderation")).toBeInTheDocument();
    expect(screen.getAllByText("Custom Emote Pack").length).toBeGreaterThan(0);
    expect(screen.getByText("Visibility:").closest("p")).toHaveTextContent(
      "Visible"
    );
    expect(screen.getByRole("button", { name: "Hide listing" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Restore listing" })
    ).not.toBeInTheDocument();
  });

  it("hides a visible listing through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide listing" }));

    await waitFor(() => {
      expect(mocks.hideListing).toHaveBeenCalledWith({
        listingId: "listing-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Listing hidden from public visibility.")
    ).toBeInTheDocument();
  });

  it("shows the restore action for admin-hidden published listings", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: false,
          adminHiddenAt: "2026-05-13T12:00:00.000Z",
          adminHiddenByUserId: "admin-1",
          adminHiddenReportId: "report-1",
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Listing moderation")).toBeInTheDocument();
    expect(screen.getByText("Visibility:").closest("p")).toHaveTextContent(
      "Hidden by admin"
    );
    expect(
      screen.getByRole("button", { name: "Restore listing" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Hide listing" })
    ).not.toBeInTheDocument();
  });

  it("restores an admin-hidden published listing through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: false,
          adminHiddenAt: "2026-05-13T12:00:00.000Z",
          adminHiddenByUserId: "admin-1",
          adminHiddenReportId: "report-1",
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Restore listing" }));

    await waitFor(() => {
      expect(mocks.restoreListing).toHaveBeenCalledWith({
        listingId: "listing-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Listing restored to public visibility.")
    ).toBeInTheDocument();
  });

  it("does not allow draft listings to be restored to public visibility", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "draft",
          isActive: false,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByRole("button", { name: "Restore listing" })
    ).toBeDisabled();

    expect(
      screen.getByText(
        "Only published listings can be restored to public visibility. Draft listings should stay hidden."
      )
    ).toBeInTheDocument();
  });

  it("shows a useful error when hiding a listing fails", async () => {
    mocks.hideListing.mockRejectedValue(
      new Error("Moderation report is not tied to this listing.")
    );

    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide listing" }));

    expect(
      await screen.findByText("Moderation report is not tied to this listing.")
    ).toBeInTheDocument();
  });

  it("shows profile context for profile reports", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Target context")).toBeInTheDocument();
    expect(screen.getAllByText("@creatoruser").length).toBeGreaterThan(0);

    expect(
      screen.queryByText("Target context is not available for this report type yet.")
    ).not.toBeInTheDocument();
  });

  it("shows the mark-under-review action for profile reports not under review", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: false,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Profile moderation")).toBeInTheDocument();
    expect(screen.getByText("Review state:").closest("p")).toHaveTextContent(
      "Not under review"
    );
    expect(
      screen.getByRole("button", { name: "Mark under review" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Clear review flag" })
    ).not.toBeInTheDocument();
  });

  it("marks a profile under review through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: false,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Mark under review" }));

    await waitFor(() => {
      expect(mocks.markProfileUnderReview).toHaveBeenCalledWith({
        profileUserId: "reported-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Profile marked under review.")
    ).toBeInTheDocument();
  });

  it("shows the clear-review action for profile reports under review", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Profile moderation")).toBeInTheDocument();
    expect(screen.getByText("Review state:").closest("p")).toHaveTextContent(
      "Under review"
    );
    expect(
      screen.getByRole("button", { name: "Clear review flag" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Mark under review" })
    ).not.toBeInTheDocument();
  });

  it("clears a profile review flag through the admin RPC hook", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Clear review flag" }));

    await waitFor(() => {
      expect(mocks.clearProfileReviewFlag).toHaveBeenCalledWith({
        profileUserId: "reported-1",
        moderationReportId: "report-1",
      });
    });

    expect(
      await screen.findByText("Profile review flag cleared.")
    ).toBeInTheDocument();
  });

  it("shows profile moderation history actions", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: true,
        },
        profileModerationActions: [
          {
            id: "profile-action-1",
            actionType: "under_review",
            previousIsUnderReview: false,
            newIsUnderReview: true,
            adminNote: "Reviewing repeated reports.",
          },
        ],
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Profile moderation history")).toBeInTheDocument();
    expect(screen.getByText("Marked under review")).toBeInTheDocument();
    expect(screen.getByText("Reviewing repeated reports.")).toBeInTheDocument();
    expect(screen.getByText(/@adminuser/)).toBeInTheDocument();
  });

  it("sends an internal note when locking a conversation", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({ conversationStatus: "open" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText("Internal moderation action note"), {
      target: {
        value: "Locking while reviewing the report.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lock conversation" }));

    await waitFor(() => {
      expect(mocks.lockConversation).toHaveBeenCalledWith({
        conversationId: "conversation-1",
        moderationReportId: "report-1",
        adminNote: "Locking while reviewing the report.",
      });
    });
  });

  it("sends an internal note when hiding a listing", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        listing: {
          status: "published",
          isActive: true,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText("Internal moderation action note"), {
      target: {
        value: "Hidden while checking listing report.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Hide listing" }));

    await waitFor(() => {
      expect(mocks.hideListing).toHaveBeenCalledWith({
        listingId: "listing-1",
        moderationReportId: "report-1",
        adminNote: "Hidden while checking listing report.",
      });
    });
  });

  it("sends an internal note when marking a profile under review", async () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        profileReport: true,
        profileModerationState: {
          isUnderReview: false,
        },
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText("Internal moderation action note"), {
      target: {
        value: "Multiple reports need a closer look.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark under review" }));

    await waitFor(() => {
      expect(mocks.markProfileUnderReview).toHaveBeenCalledWith({
        profileUserId: "reported-1",
        moderationReportId: "report-1",
        adminNote: "Multiple reports need a closer look.",
      });
    });
  });

  it("requires a resolution before saving a resolved report", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({ conversationStatus: "open" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: {
        value: "resolved",
      },
    });

    expect(
      screen.getByText(
        "A resolution is required before this report can be marked resolved."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Save report update" })
    ).toBeDisabled();
  });

  it("shows when the reporter has not seen the latest moderator update", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        conversationStatus: "open",
        reporterStatusUpdatedAt: "2026-05-10T12:00:00.000Z",
        reporterSeenAt: null,
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "The reporter has not seen the latest moderator update yet."
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/Last seen by reporter:/)).toBeInTheDocument();
    expect(screen.getByText(/Not seen yet/)).toBeInTheDocument();
  });

  it("shows when the reporter has seen the latest moderator update", () => {
    mocks.useAdminModerationReport.mockReturnValue({
      data: createReportData({
        conversationStatus: "open",
        reporterStatusUpdatedAt: "2026-05-10T12:00:00.000Z",
        reporterSeenAt: "2026-05-10T12:30:00.000Z",
      }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "The reporter has seen the latest moderator update, or no reporter-visible update has been sent."
      )
    ).toBeInTheDocument();
  });
});