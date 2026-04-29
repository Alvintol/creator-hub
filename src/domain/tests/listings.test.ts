import { describe, expect, it } from "vitest";
import {
  allowsInstantFulfilment,
  getAllowedFulfilmentModes,
  getFulfilmentModeCopy,
  normaliseFulfilmentMode,
} from "../listings/listings";

describe("listings domain helpers", () => {
  it("allows instant fulfilment only for digital listings", () => {
    expect(allowsInstantFulfilment("digital")).toBe(true);
    expect(allowsInstantFulfilment("commission")).toBe(false);
    expect(allowsInstantFulfilment("service")).toBe(false);
  });

  it("returns the correct allowed fulfilment modes for each offering type", () => {
    expect(getAllowedFulfilmentModes("digital")).toEqual(["request", "instant"]);
    expect(getAllowedFulfilmentModes("commission")).toEqual(["request"]);
    expect(getAllowedFulfilmentModes("service")).toEqual(["request"]);
  });

  it("normalises invalid instant combinations back to request", () => {
    expect(normaliseFulfilmentMode("digital", "instant")).toBe("instant");
    expect(normaliseFulfilmentMode("digital", "request")).toBe("request");
    expect(normaliseFulfilmentMode("commission", "instant")).toBe("request");
    expect(normaliseFulfilmentMode("service", "instant")).toBe("request");
  });

  it("returns request CTA copy for request listings", () => {
    expect(getFulfilmentModeCopy("request")).toEqual({
      title: "Request flow coming soon",
      text:
        "This listing is intended to start with creator review or confirmation before work begins.",
      primaryLabel: "Request this listing soon",
    });
  });

  it("returns instant CTA copy for instant listings", () => {
    expect(getFulfilmentModeCopy("instant")).toEqual({
      title: "Instant purchase coming soon",
      text:
        "This listing is intended for direct repeat purchases once digital delivery is added.",
      primaryLabel: "Buy instantly soon",
    });
  });
});