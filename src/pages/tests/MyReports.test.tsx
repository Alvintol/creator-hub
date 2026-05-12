import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyReports from "../reports/MyReports";

const mocks = vi.hoisted(() => ({
  useMyModerationReports: vi.fn(),
  markReportsSeen: vi.fn(),
}));

vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: mocks.useMyModerationReports,
  useMarkMyModerationReportsSeen: () => ({
    mutate: mocks.markReportsSeen,
    isPending: false,
  }),
}));

const createReport = (overrides = {}) => ({
  id: "report-1",
  target_type: "listing",
  target_label: "Custom Emote Pack",
  reason_code: "harassment",
  reason_details: "This listing looks misleading.",
  status: "submitted",
  reporter_status_message: null,
  reporter_status_updated_at: null,
  resolution_code: null,
  resolved_at: null,
  created_at: "2026-05-09T12:00:00.000Z",
  has_unread_update: false,
  reporter_seen_at: null,
  ...overrides,
});

vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: mocks.useMyModerationReports,
  useMarkMyModerationReportsSeen: () => ({
    mutate: mocks.markReportsSeen,
    isPending: false,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <MyReports />
    </MemoryRouter>
  );

describe("<MyReports />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useMyModerationReports.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it("shows an empty state when the user has not submitted reports", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("My reports")).toBeInTheDocument();
    expect(
      screen.getByText("You have not submitted any reports yet.")
    ).toBeInTheDocument();
  });

  it("renders submitted report details", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          target_type: "listing",
          target_label: "Custom Emote Pack",
          status: "submitted",
          resolved_at: null,
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Harassment or abusive behaviour")
    ).toBeInTheDocument();
    expect(screen.getByText(/This listing looks misleading./)).toBeInTheDocument();
  });

  it("renders moderator updates that are safe for the reporter to see", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          reporter_status_message:
            "Thanks for the report. We are reviewing this now.",
          reporter_status_updated_at: "2026-05-09T13:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText(/Moderator update:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Thanks for the report. We are reviewing this now./)
    ).toBeInTheDocument();
  });

  it("renders resolved reports", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          status: "resolved",
          resolution_code: "action_taken",
          resolved_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
    expect(screen.getByText(/May 10, 2026/)).toBeInTheDocument();
  });

  it("does not expose internal admin notes", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        {
          ...createReport(),
          admin_notes: "This should never be displayed to the reporter.",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByText("This should never be displayed to the reporter.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/admin note/i)).not.toBeInTheDocument();
  });

  it("shows an error state when reports cannot load", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load reports."),
    });

    renderPage();

    expect(
      screen.getByText("Your reports could not be loaded right now.")
    ).toBeInTheDocument();
  });

  it("marks unread moderator updates as seen when the page loads", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          has_unread_update: true,
          reporter_status_message: "We reviewed this report.",
          reporter_status_updated_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(mocks.markReportsSeen).toHaveBeenCalled();
  });

  it("shows an unread moderator update indicator", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          has_unread_update: true,
          reporter_status_message: "We reviewed this report.",
          reporter_status_updated_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("New moderator update")).toBeInTheDocument();
    expect(screen.getByText(/We reviewed this report./)).toBeInTheDocument();
  });

  it("marks unread moderator updates as seen after reports load", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        createReport({
          has_unread_update: true,
          reporter_status_message: "We reviewed this report.",
          reporter_status_updated_at: "2026-05-10T12:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(mocks.markReportsSeen).toHaveBeenCalled();
  });

});