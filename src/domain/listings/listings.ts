export type ListingOfferingType = "digital" | "commission" | "service";
export type ListingPriceType = "fixed" | "starting_at" | "range";
export type ListingVideoSubtype = "" | "long-form" | "short-form";
export type ListingFulfilmentMode = "request" | "instant";

export const listingOfferingTypeOptions: Array<{
  value: ListingOfferingType;
  label: string;
}> = [
    { value: "digital", label: "Digital" },
    { value: "commission", label: "Commission" },
    { value: "service", label: "Service" },
  ];

export const listingPriceTypeOptions: Array<{
  value: ListingPriceType;
  label: string;
}> = [
    { value: "fixed", label: "Fixed price" },
    { value: "starting_at", label: "Starting at" },
    { value: "range", label: "Price range" },
  ];

export const listingVideoSubtypeOptions: Array<{
  value: ListingVideoSubtype;
  label: string;
}> = [
    { value: "", label: "None" },
    { value: "long-form", label: "Long-form" },
    { value: "short-form", label: "Short-form" },
  ];

export const listingFulfilmentModeOptions: Array<{
  value: ListingFulfilmentMode;
  label: string;
}> = [
    { value: "request", label: "Request approval" },
    { value: "instant", label: "Instant purchase" },
  ];

// Only digital listings can be sold instantly in this first pass
export const allowsInstantFulfilment = (
  offeringType: ListingOfferingType
): boolean => offeringType === "digital";

// Returns the allowed fulfilment modes for the chosen offering type
export const getAllowedFulfilmentModes = (
  offeringType: ListingOfferingType
): ListingFulfilmentMode[] =>
  allowsInstantFulfilment(offeringType) ? ["request", "instant"] : ["request"];

// Returns the correct default fulfilment mode for the chosen offering type
export const getDefaultFulfilmentMode = (
  offeringType: ListingOfferingType
): ListingFulfilmentMode =>
  allowsInstantFulfilment(offeringType) ? "request" : "request";

// Forces invalid combinations back to request mode
export const normaliseFulfilmentMode = (
  offeringType: ListingOfferingType,
  fulfilmentMode: ListingFulfilmentMode
): ListingFulfilmentMode =>
  allowsInstantFulfilment(offeringType) ? fulfilmentMode : "request";

// Buyer-facing CTA copy for public listing pages
export const getFulfilmentModeCopy = (
  fulfilmentMode: ListingFulfilmentMode
) =>
  fulfilmentMode === "instant"
    ? {
      title: "Instant purchase coming soon",
      text:
        "This listing is intended for direct repeat purchases once digital delivery is added.",
      primaryLabel: "Buy instantly soon",
    }
    : {
      title: "Request flow coming soon",
      text:
        "This listing is intended to start with creator review or confirmation before work begins.",
      primaryLabel: "Request this listing soon",
    };