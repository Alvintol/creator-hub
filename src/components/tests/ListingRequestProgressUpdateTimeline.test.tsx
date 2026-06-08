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
import type { ListingRequestProgressUpdateRow } from "../../hooks/creatorRequests/useListingRequestProgressUpdates";

const createProgressUpdate = (
  overrides?: Partial<ListingRequestProgressUpdateRow>
): ListingRequestProgressUpdateRow => ({
  id: "progress-update-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  update_kind: "progress",
  title: "Initial concepts completed",
  body: "The first concept sketches are ready for review.",
  progress_percent: 35,
  created_at: "2026-06-06T12:00:00.000Z",
  updated_at: "2026-06-06T12:00:00.000Z",
  ...overrides,
});

describe("ListingRequestProgressUpdateTimeline", () => {
  it("renders a loading state", () => {
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
  });

  it("renders an empty state", () => {
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

  it("renders query errors instead of the empty state", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[]}
        error={
          new Error(
            "Progress updates could not be loaded."
          )
        }
      />
    );

    expect(
      screen.getByText(
        "Progress updates could not be loaded."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "No project progress updates have been posted yet."
      )
    ).not.toBeInTheDocument();
  });

  it("renders progress update details", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[createProgressUpdate()]}
      />
    );

    expect(
      screen.getByText("Project progress updates")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Initial concepts completed")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The first concept sketches are ready for review."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Progress update")
    ).toBeInTheDocument();

    expect(
      screen.getByText("35% complete")
    ).toBeInTheDocument();

    expect(screen.getByText(/^Posted /)).toBeInTheDocument();
  });

  it("renders each supported update type", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[
          createProgressUpdate({
            id: "progress-1",
            update_kind: "progress",
            title: "General progress",
          }),
          createProgressUpdate({
            id: "milestone-1",
            update_kind: "milestone",
            title: "Milestone reached",
          }),
          createProgressUpdate({
            id: "delay-1",
            update_kind: "delay",
            title: "Schedule changed",
          }),
          createProgressUpdate({
            id: "preview-1",
            update_kind: "final_preview",
            title: "Final preview ready",
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Progress update")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Milestone update")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Schedule update")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Final preview")
    ).toBeInTheDocument();
  });

  it("orders the newest update first", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[
          createProgressUpdate({
            id: "older-update",
            title: "Older update",
            created_at: "2026-06-01T12:00:00.000Z",
          }),
          createProgressUpdate({
            id: "newer-update",
            title: "Newer update",
            created_at: "2026-06-06T12:00:00.000Z",
          }),
        ]}
      />
    );

    const headings = screen.getAllByRole("heading", {
      level: 3,
    });

    expect(headings[0]).toHaveTextContent(
      "Newer update"
    );

    expect(headings[1]).toHaveTextContent(
      "Older update"
    );
  });

  it("does not show a percentage when none was supplied", () => {
    render(
      <ListingRequestProgressUpdateTimeline
        updates={[
          createProgressUpdate({
            progress_percent: null,
          }),
        ]}
      />
    );

    expect(
      screen.queryByText(/% complete/)
    ).not.toBeInTheDocument();
  });
});