import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminModerationReports from "../admin/AdminModerationReports";
import type {
  AdminModerationReportItem,
  AdminModerationReportsResult,
} from "../../hooks/admin/useAdminModerationReports";

const mocks = vi.hoisted(() => ({
  useAdminModerationReports: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminModerationReports", () => ({
  useAdminModerationReports: mocks.useAdminModerationReports,
}));

const createReport = (
  overrides: Partial<AdminModerationReportItem["report"]> = {}
): AdminModerationReportItem["report"] => ({
  id: "report-1",
  target_type: "conversation",
  conversation_id: "conversation-1",
  message_id: null,
  listing_id: null,
  profile_user_id: null,
  reporter_user_id: "reporter-1",
  reported_user_id: "reported-1",
  reason_code: "harassment",
  reason_details: "The reported user was hostile.",
  status: "submitted",
  reporter_status_message: null,
  reporter_status_updated_at: null,
  resolution_code: null,
  resolved_at: null,
  reviewed_at: null,
  reviewed_by_user_id: null,
  admin_notes: null,
  created_at: "2026-05-10T12:00:00.000Z",
  ...overrides,
});

const createBaseItem = (
  overrides: Partial<AdminModerationReportItem> = {}
): AdminModerationReportItem => ({
  report: createReport(),
  conversation: {
    id: "conversation-1",
    conversation_type: "creator_inquiry",
    subject: "Custom emote inquiry",
    listing_id: null,
    listing_request_id: null,
    status: "open",
    last_message_at: "2026-05-10T12:05:00.000Z",
    last_message_preview: "Can you make this in my style?",
    created_at: "2026-05-10T12:00:00.000Z",
    updated_at: "2026-05-10T12:05:00.000Z",
  },
  listing: null,
  profileModerationState: null,
  reporter: {
    user_id: "reporter-1",
    handle: "reporteruser",
    display_name: "Reporter User",
    avatar_url: null,
  },
  reportedUser: {
    user_id: "reported-1",
    handle: "reporteduser",
    display_name: "Reported User",
    avatar_url: null,
  },
  ...overrides,
});

const createResult = (
  items: AdminModerationReportItem[] = []
): AdminModerationReportsResult => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 20,
  pageCount: items.length > 0 ? 1 : 0,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminModerationReports />
    </MemoryRouter>
  );

describe("<AdminModerationReports />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult(),
      isLoading: false,
      error: null,
    });
  });

  it("shows an empty state when no reports match", () => {
    renderPage();

    expect(screen.getByText("Reports and moderation")).toBeInTheDocument();
    expect(
      screen.getByText("No reports matched the current filters.")
    ).toBeInTheDocument();
  });

  it("shows conversation report target state", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult([
        createBaseItem({
          conversation: {
            id: "conversation-1",
            conversation_type: "creator_inquiry",
            subject: "Custom emote inquiry",
            listing_id: null,
            listing_request_id: null,
            status: "admin_locked",
            last_message_at: null,
            last_message_preview: null,
            created_at: "2026-05-10T12:00:00.000Z",
            updated_at: "2026-05-10T12:05:00.000Z",
          },
        }),
      ]),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Conversation report")).toBeInTheDocument();
    expect(screen.getByText("Custom emote inquiry")).toBeInTheDocument();
    expect(screen.getByText("Locked by admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review report" })).toHaveAttribute(
      "href",
      "/admin/reports/report-1"
    );
  });

  it("shows listing report title and visible state", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult([
        createBaseItem({
          report: createReport({
            id: "report-listing-1",
            target_type: "listing",
            conversation_id: null,
            listing_id: "listing-1",
          }),
          conversation: null,
          listing: {
            id: "listing-1",
            user_id: "reported-1",
            title: "Custom Emote Pack",
            status: "published",
            is_active: true,
            created_at: "2026-05-10T12:00:00.000Z",
            updated_at: "2026-05-10T12:05:00.000Z",
          },
        }),
      ]),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Listing report")).toBeInTheDocument();
    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("Listing visible")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review report" })).toHaveAttribute(
      "href",
      "/admin/reports/report-listing-1"
    );
  });

  it("shows hidden listing state", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult([
        createBaseItem({
          report: createReport({
            id: "report-listing-2",
            target_type: "listing",
            conversation_id: null,
            listing_id: "listing-1",
          }),
          conversation: null,
          listing: {
            id: "listing-1",
            user_id: "reported-1",
            title: "Hidden Emote Pack",
            status: "published",
            is_active: false,
            created_at: "2026-05-10T12:00:00.000Z",
            updated_at: "2026-05-10T12:05:00.000Z",
          },
        }),
      ]),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Hidden Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("Listing hidden")).toBeInTheDocument();
  });

  it("shows profile under-review state", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult([
        createBaseItem({
          report: createReport({
            id: "report-profile-1",
            target_type: "profile",
            conversation_id: null,
            profile_user_id: "reported-1",
          }),
          conversation: null,
          profileModerationState: {
            profile_user_id: "reported-1",
            is_under_review: true,
            updated_at: "2026-05-10T12:05:00.000Z",
          },
        }),
      ]),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Profile report")).toBeInTheDocument();
    expect(screen.getByText("Profile under review")).toBeInTheDocument();
    expect(screen.getByText("reported-1")).toBeInTheDocument();
  });

  it("shows not-under-review profile state", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: createResult([
        createBaseItem({
          report: createReport({
            id: "report-profile-2",
            target_type: "profile",
            conversation_id: null,
            profile_user_id: "reported-1",
          }),
          conversation: null,
          profileModerationState: {
            profile_user_id: "reported-1",
            is_under_review: false,
            updated_at: "2026-05-10T12:05:00.000Z",
          },
        }),
      ]),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Not under review")).toBeInTheDocument();
  });

  it("resets filters and page when reset is clicked", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Reporter username"), {
      target: {
        value: "@reporteruser",
      },
    });

    fireEvent.change(screen.getByLabelText("Target type"), {
      target: {
        value: "listing",
      },
    });

    expect(screen.getByLabelText("Reporter username")).toHaveValue(
      "@reporteruser"
    );
    expect(screen.getByLabelText("Target type")).toHaveValue("listing");

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(screen.getByLabelText("Reporter username")).toHaveValue("");
    expect(screen.getByLabelText("Target type")).toHaveValue("all");
  });

  it("shows an error state when reports fail to load", () => {
    mocks.useAdminModerationReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load reports."),
    });

    renderPage();

    expect(
      screen.getByText("Reports could not be loaded right now.")
    ).toBeInTheDocument();
  });
});