import { describe, expect, it } from "vitest";

import { getCreateListingRequestErrorMessage } from "../listings/listingRequestErrors";

describe("listing request error helpers", () => {
  it("maps row-level security errors to unavailable listing copy", () => {
    expect(
      getCreateListingRequestErrorMessage({
        code: "42501",
        message: "new row violates row-level security policy",
      })
    ).toBe("This listing is no longer available for buyer requests.");
  });

  it("maps request title constraint errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message:
          'new row for relation "listing_requests" violates check constraint "listing_requests_request_title_check"',
      })
    ).toBe("Request summary must be between 3 and 120 characters.");
  });

  it("maps request details constraint errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message:
          'new row for relation "listing_requests" violates check constraint "listing_requests_request_details_check"',
      })
    ).toBe("Request details must be between 10 and 2000 characters.");
  });

  it("maps timeline constraint errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message:
          'new row for relation "listing_requests" violates check constraint "listing_requests_requested_timeline_check"',
      })
    ).toBe("Timeline must be 160 characters or fewer.");
  });

  it("maps budget constraint errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message:
          'new row for relation "listing_requests" violates check constraint "listing_requests_budget_amount_check"',
      })
    ).toBe("Budget must be a valid amount between 0 and 999999.99.");
  });

  it("maps reference link count constraint errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message:
          'new row for relation "listing_requests" violates check constraint "listing_requests_reference_links_check"',
      })
    ).toBe("Add up to 5 reference links.");
  });

  it("maps foreign key errors to missing listing copy", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message: "insert or update on table violates foreign key constraint",
      })
    ).toBe("This listing could not be found or is no longer available.");
  });

  it("returns safe generic copy for unknown errors", () => {
    expect(
      getCreateListingRequestErrorMessage({
        message: "Unexpected database issue.",
      })
    ).toBe("Your request could not be submitted right now.");
  });
});