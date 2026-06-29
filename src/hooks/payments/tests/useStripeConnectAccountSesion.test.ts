import { describe, expect, it } from "vitest";
import {
  getNonJsonApiResponseMessage,
  getStripeConnectAccountSessionFallbackError,
} from "../useStripeConnectAccountSession";

describe("useStripeConnectAccountSession", () => {
  it("returns a friendly fallback error message", () => {
    expect(getStripeConnectAccountSessionFallbackError(500)).toBe(
      "Stripe Connect setup failed (500)",
    );
  });

  it("describes non-JSON API responses", () => {
    expect(
      getNonJsonApiResponseMessage({
        status: 404,
        body: "<!doctype html><html><body>Not found</body></html>",
      }),
    ).toContain("Stripe Connect setup returned a non-JSON response (404)");
  });
});