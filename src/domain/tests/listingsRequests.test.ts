import { describe, expect, it } from "vitest";
import {
  canAcceptListingRequest,
  canArchiveListingRequest,
  canDeclineListingRequest,
  getListingRequestStatusLabel,
  getListingRequestStatusSummary,
  getListingRequestStatusTone,
} from "../listings/listingRequests";

describe("listing request status helpers", () => {
  it("maps statuses to the correct labels", () => {
    expect(getListingRequestStatusLabel("submitted")).toBe("Under review");
    expect(getListingRequestStatusLabel("accepted")).toBe("Accepted");
    expect(getListingRequestStatusLabel("declined")).toBe("Declined");
    expect(getListingRequestStatusLabel("archived")).toBe("Archived");
  });

  it("maps statuses to the correct tones", () => {
    expect(getListingRequestStatusTone("submitted")).toBe("review");
    expect(getListingRequestStatusTone("accepted")).toBe("success");
    expect(getListingRequestStatusTone("declined")).toBe("danger");
    expect(getListingRequestStatusTone("archived")).toBe("muted");
  });

  it("maps statuses to the correct summaries", () => {
    expect(getListingRequestStatusSummary("submitted")).toBe(
      "This request is currently under review by the creator."
    );
    expect(getListingRequestStatusSummary("accepted")).toBe(
      "The creator has accepted this request."
    );
    expect(getListingRequestStatusSummary("declined")).toBe(
      "The creator has declined this request."
    );
    expect(getListingRequestStatusSummary("archived")).toBe(
      "This request has been archived."
    );
  });

  it("only allows accept and decline while the request is submitted", () => {
    expect(canAcceptListingRequest("submitted")).toBe(true);
    expect(canDeclineListingRequest("submitted")).toBe(true);

    expect(canAcceptListingRequest("accepted")).toBe(false);
    expect(canAcceptListingRequest("declined")).toBe(false);
    expect(canAcceptListingRequest("archived")).toBe(false);

    expect(canDeclineListingRequest("accepted")).toBe(false);
    expect(canDeclineListingRequest("declined")).toBe(false);
    expect(canDeclineListingRequest("archived")).toBe(false);
  });

  it("allows archive for every non-archived status only", () => {
    expect(canArchiveListingRequest("submitted")).toBe(true);
    expect(canArchiveListingRequest("accepted")).toBe(true);
    expect(canArchiveListingRequest("declined")).toBe(true);
    expect(canArchiveListingRequest("archived")).toBe(false);
  });
});