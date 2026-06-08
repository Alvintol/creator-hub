import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import ListingRequestProgressUpdateTimeline from "../ListingRequestProgressUpdateTimeline";
import type {
  ListingRequestProgressUpdateRow,
} from "../../hooks/creatorRequests/useListingRequestProgressUpdates";

const createProgressUpdate = (
  overrides?: Partial<ListingRequestProgressUpdateRow>
): ListingRequestProgressUpdateRow => ({
  id: "progress-update-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  update_kind: "progress",
  title: "Initial concepts started",
  body: "The creator has started work on the initial concepts.",
  progress_percent: 20,
  created_at: "2026-06-06T12:00:00.000Z",
  updated_at: "2026-06-06T12:00:00.000Z",
  ...overrides,
});

describe("ListingRequestProgressUpdateTimeline", () => {
  it("renders the loading state", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[]}
        isLoading
      />
    );

    expect(
      screen.getByText(
        "Loading project progress updates…"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "No project progress updates have been posted yet."
      )
    ).not.toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[]}
      />
    );

    expect(
      screen.getByText(
        "No project progress updates have been posted yet."
      )
    ).toBeInTheDocument();
  });

  it("renders query errors", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[]}
        error={
          new Error(
            "Project progress updates are unavailable."
          )
        }
      />
    );

    expect(
      screen.getByText(
        "Project progress updates are unavailable."
      )
    ).toBeInTheDocument();
  });

  it("renders progress update details", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[createProgressUpdate()]}
      />
    );

    expect(
      screen.getByText("Initial concepts started")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The creator has started work on the initial concepts."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Progress update")
    ).toBeInTheDocument();

    expect(
      screen.getByText("20% complete")
    ).toBeInTheDocument();
  });

  it("renders updates newest first", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[
          createProgressUpdate({
            id: "older-update",
            title: "Older update",
            created_at: "2026-06-06T12:00:00.000Z",
          }),
          createProgressUpdate({
            id: "newer-update",
            update_kind: "milestone",
            title: "Newer milestone",
            created_at: "2026-06-08T12:00:00.000Z",
          }),
        ]}
      />
    );

    const headings = screen.getAllByRole("heading", {
      level: 3,
    });

    expect(headings[0]).toHaveTextContent(
      "Newer milestone"
    );

    expect(headings[1]).toHaveTextContent(
      "Older update"
    );

    expect(
      screen.getByText("Milestone update")
    ).toBeInTheDocument();
  });

  it("does not show a percentage when none was supplied", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[
          createProgressUpdate({
            update_kind: "delay",
            title: "Schedule adjustment",
            progress_percent: null,
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Schedule update")
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/% complete/)
    ).not.toBeInTheDocument();
  });
});