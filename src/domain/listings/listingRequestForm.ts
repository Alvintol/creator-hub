export type ListingRequestFormInput = {
  requestTitle: string;
  requestDetails: string;
  requestedTimeline: string;
  budgetText: string;
  referenceLinksText: string;
};

export type ListingRequestFormErrors = {
  requestTitle?: string;
  requestDetails?: string;
  requestedTimeline?: string;
  budgetAmount?: string;
  referenceLinks?: string;
};

export type ValidListingRequestForm = {
  requestTitle: string;
  requestDetails: string;
  requestedTimeline?: string;
  budgetAmount: number | null;
  referenceLinks: string[];
};

export type ListingRequestFormValidationResult = {
  values: ValidListingRequestForm | null;
  errors: ListingRequestFormErrors;
};

export const parseListingRequestReferenceLinks = (value: string): string[] =>
  value
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);

export const isValidListingRequestReferenceUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const validateListingRequestForm = (
  input: ListingRequestFormInput
): ListingRequestFormValidationResult => {
  const errors: ListingRequestFormErrors = {};

  const requestTitle = input.requestTitle.trim();
  const requestDetails = input.requestDetails.trim();
  const requestedTimeline = input.requestedTimeline.trim();
  const budgetText = input.budgetText.trim();
  const referenceLinks = parseListingRequestReferenceLinks(
    input.referenceLinksText
  );

  if (requestTitle.length < 3 || requestTitle.length > 120) {
    errors.requestTitle = "Summary must be between 3 and 120 characters.";
  }

  if (requestDetails.length < 10 || requestDetails.length > 2000) {
    errors.requestDetails = "Details must be between 10 and 2000 characters.";
  }

  if (requestedTimeline.length > 160) {
    errors.requestedTimeline = "Timeline must be 160 characters or fewer.";
  }

  const budgetAmount = budgetText ? Number(budgetText) : null;

  if (
    budgetText &&
    (!Number.isFinite(budgetAmount) ||
      Number(budgetAmount) < 0 ||
      Number(budgetAmount) > 999999.99)
  ) {
    errors.budgetAmount =
      "Budget must be a valid amount between 0 and 999999.99.";
  }

  if (referenceLinks.length > 5) {
    errors.referenceLinks = "Add up to 5 reference links.";
  } else if (
    referenceLinks.some((link) => !isValidListingRequestReferenceUrl(link))
  ) {
    errors.referenceLinks =
      "Reference links must start with http:// or https://.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      values: null,
      errors,
    };
  }

  return {
    values: {
      requestTitle,
      requestDetails,
      requestedTimeline: requestedTimeline || undefined,
      budgetAmount,
      referenceLinks,
    },
    errors,
  };
};