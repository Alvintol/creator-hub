import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListingPage from "../listings/Listing";

const mocks = vi.hoisted(() => ({
  usePublicListing: vi.fn(),
  useTwitchStreams: vi.fn(),
  useAuth: vi.fn(),
  submitListingReport: vi.fn(),
}));

vi.mock("../../hooks/listings/usePublicListing", () => ({
  usePublicListing: mocks.usePublicListing,
}));

vi.mock("../../hooks/useTwitchStreams", () => ({
  useTwitchStreams: mocks.useTwitchStreams,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

// Match this path to the exact path used by Listing.tsx.
// If your component still imports `useSubmitListingModerationRepotr` with the typo,
// use that typo path here too.
vi.mock("../../hooks/moderation/useSubmitListingModerationReport", () => ({
  useSubmitListingModerationReport: () => ({
    mutateAsync: mocks.submitListingReport,
    isPending: false,
  }),
}));

const createListingData = () => ({
  listing: {
    id: "listing-1",
    user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    preview_url: null,
    offering_type: "commission",
    category: "emotes",
    video_subtype: "",
    deliverables: ["3 emotes", "PNG files"],
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    fulfilment_mode: "request",
    updated_at: "2026-05-09T12:00:00.000Z",
  },
  creator: {
    user_id: "creator-1",
    handle: "creatoruser",
    display_name: "Creator User",
  },
  platformAccounts: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/listing/listing-1"]}>
      <Routes>
        <Route path="/listing/:id" element={<ListingPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("<ListingPage /> report UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.usePublicListing.mockReturnValue({
      data: createListingData(),
      isLoading: false,
      error: null,
    });

    mocks.useTwitchStreams.mockReturnValue({
      twitchByLogin: {},
    });

    mocks.useAuth.mockReturnValue({
      user: null,
    });

    mocks.submitListingReport.mockResolvedValue("report-1");
  });

  it("shows a sign-in prompt for signed-out users", () => {
    renderPage();

    expect(screen.getByText("Report listing")).toBeInTheDocument();
    expect(
      screen.getByText("You need to sign in before reporting a listing.")
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in to report" })).toHaveAttribute(
      "href",
      "/signin"
    );
  });

  it("lets signed-in users open the listing report form", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));

    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
  });

  it("submits a listing report with details", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "This listing appears misleading.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => {
      expect(mocks.submitListingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: "listing-1",
          reasonDetails: "This listing appears misleading.",
        })
      );
    });

    expect(
      await screen.findByText("Listing report submitted. An admin will review it soon.")
    ).toBeInTheDocument();
  });

  it("shows a useful error when listing report submission fails", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.submitListingReport.mockRejectedValue(
      new Error("You already have an active report for this listing.")
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByText("You already have an active report for this listing.")
    ).toBeInTheDocument();
  });
});