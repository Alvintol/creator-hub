import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListingRequestStatusCard from "../listingRequests/core/ListingRequestStatusCard";

describe("<ListingRequestStatusCard />", () => {
  it("renders submitted request status", () => {
    render(<ListingRequestStatusCard status="submitted" />);

    expect(screen.getByText("Status: Under review")).toBeInTheDocument();
    expect(
      screen.getByText("This request is currently under review by the creator.")
    ).toBeInTheDocument();
  });

  it("renders accepted request status", () => {
    render(<ListingRequestStatusCard status="accepted" />);

    expect(screen.getByText("Status: Accepted")).toBeInTheDocument();
    expect(
      screen.getByText("The creator has accepted this request.")
    ).toBeInTheDocument();
  });

  it("renders declined request status with a decline reason", () => {
    render(
      <ListingRequestStatusCard
        status="declined"
        reason="The request does not match my current commission scope."
      />
    );

    expect(screen.getByText("Status: Declined")).toBeInTheDocument();
    expect(
      screen.getByText("The creator has declined this request.")
    ).toBeInTheDocument();
    expect(screen.getByText("Decline reason")).toBeInTheDocument();
    expect(
      screen.getByText("The request does not match my current commission scope.")
    ).toBeInTheDocument();
  });

  it("does not render the decline reason box when no reason is provided", () => {
    render(<ListingRequestStatusCard status="declined" reason={null} />);

    expect(screen.getByText("Status: Declined")).toBeInTheDocument();
    expect(screen.queryByText("Decline reason")).not.toBeInTheDocument();
  });

  it("renders generic archived status without archive context", () => {
    render(<ListingRequestStatusCard status="archived" />);

    expect(screen.getByText("Status: Archived")).toBeInTheDocument();
    expect(
      screen.getByText("This request has been archived.")
    ).toBeInTheDocument();
  });

  it("renders buyer-cancelled archive status", () => {
    render(
      <ListingRequestStatusCard
        status="archived"
        archiveContext={{
          buyer_user_id: "buyer-1",
          creator_user_id: "creator-1",
          archived_by_user_id: "buyer-1",
        }}
      />
    );

    expect(screen.getByText("Status: Cancelled by buyer")).toBeInTheDocument();
    expect(
      screen.getByText("The buyer cancelled this request.")
    ).toBeInTheDocument();
  });

  it("renders creator-archived status", () => {
    render(
      <ListingRequestStatusCard
        status="archived"
        archiveContext={{
          buyer_user_id: "buyer-1",
          creator_user_id: "creator-1",
          archived_by_user_id: "creator-1",
        }}
      />
    );

    expect(screen.getByText("Status: Archived by creator")).toBeInTheDocument();
    expect(
      screen.getByText("The creator archived this request.")
    ).toBeInTheDocument();
  });
});