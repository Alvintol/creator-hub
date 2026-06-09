import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import ListingRequestFinalDeliverySummary from "../ListingRequestFinalDeliverySummary";
import type { ListingRequestFinalDeliveryRow } from "../../hooks/creatorRequests/useListingRequestFinalDeliveries";

const createFinalDelivery = (
  overrides?: Partial<ListingRequestFinalDeliveryRow>
): ListingRequestFinalDeliveryRow => ({
  id: "final-delivery-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  version_number: 1,
  status: "submitted",
  title: "Final overlay delivery",
  summary:
    "The completed overlay package is ready for buyer review.",
  delivery_links: [
    "https://example.com/final-overlay",
    "https://example.com/source-files",
  ],
  agreement_snapshot: {
    agreement_id: "agreement-1",
  },
  revision_request_reason: null,
  submitted_at: "2026-06-09T12:00:00.000Z",
  revision_requested_at: null,
  buyer_approved_at: null,
  cancelled_at: null,
  superseded_at: null,
  created_at: "2026-06-09T12:00:00.000Z",
  updated_at: "2026-06-09T12:00:00.000Z",
  ...overrides,
});

describe("ListingRequestFinalDeliverySummary", () => {
  it("renders the loading state", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[]}
        viewer="creator"
        isLoading
      />
    );

    expect(
      screen.getByText(
        "Loading final deliveries…"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "No final project delivery has been created yet."
      )
    ).not.toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText(
        "No final project delivery has been created yet."
      )
    ).toBeInTheDocument();
  });

  it("renders query errors", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[]}
        viewer="creator"
        error={
          new Error(
            "Final deliveries are unavailable."
          )
        }
      />
    );

    expect(
      screen.getByText(
        "Final deliveries are unavailable."
      )
    ).toBeInTheDocument();
  });

  it("renders submitted delivery details and links", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery(),
        ]}
        viewer="buyer"
      />
    );

    expect(
      screen.getByText("Final overlay delivery")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The completed overlay package is ready for buyer review."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Awaiting buyer review")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Jun 9, 2026")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Delivery link 1",
      })
    ).toHaveAttribute(
      "href",
      "https://example.com/final-overlay"
    );

    expect(
      screen.getByRole("link", {
        name: "Delivery link 2",
      })
    ).toHaveAttribute(
      "href",
      "https://example.com/source-files"
    );
  });

  it("renders newest delivery versions first", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery({
            id: "older-delivery",
            version_number: 1,
            title: "Older delivery",
          }),
          createFinalDelivery({
            id: "newer-delivery",
            version_number: 2,
            title: "Newer delivery",
          }),
        ]}
        viewer="creator"
      />
    );

    const headings = screen.getAllByRole("heading", {
      level: 3,
    });

    expect(headings[0]).toHaveTextContent(
      "Newer delivery"
    );

    expect(headings[1]).toHaveTextContent(
      "Older delivery"
    );
  });

  it("hides private drafts from buyers", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery({
            status: "draft",
            submitted_at: null,
            title: "Private creator draft",
          }),
        ]}
        viewer="buyer"
      />
    );

    expect(
      screen.queryByText("Private creator draft")
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "No final project delivery has been created yet."
      )
    ).toBeInTheDocument();
  });

  it("shows private drafts to creators", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery({
            status: "draft",
            submitted_at: null,
            delivery_links: [],
            title: "Private creator draft",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText("Private creator draft")
    ).toBeInTheDocument();

    expect(screen.getByText("Draft")).toBeInTheDocument();

    expect(
      screen.getByText(
        "No external delivery links were provided."
      )
    ).toBeInTheDocument();
  });

  it("renders a buyer revision request", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery({
            status: "revision_requested",
            revision_request_reason:
              "Please adjust the final title alignment.",
            revision_requested_at:
              "2026-06-10T12:00:00.000Z",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText("Revision requested")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Please adjust the final title alignment/
      )
    ).toBeInTheDocument();
  });

  it("renders buyer approval details", () => {
    render(
      <ListingRequestFinalDeliverySummary
        finalDeliveries={[
          createFinalDelivery({
            status: "buyer_approved",
            buyer_approved_at:
              "2026-06-11T12:00:00.000Z",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText("Approved by buyer")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Buyer approved")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Jun 11, 2026")
    ).toBeInTheDocument();
  });
});