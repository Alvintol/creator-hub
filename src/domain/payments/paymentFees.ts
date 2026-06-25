export type CreatorHubPaymentFeeInput = {
  baseAmountCents: number;
  creatorTipCents?: number;
  platformSupportCents?: number;
  buyerServiceFeeBps?: number;
  creatorPlatformFeeBps?: number;
  buyerServiceFeeMinimumCents?: number;
  creatorPlatformFeeMinimumCents?: number;
};

export type CreatorHubPaymentFeeBreakdown = {
  baseAmountCents: number;
  creatorTipCents: number;
  buyerServiceFeeCents: number;
  creatorPlatformFeeCents: number;
  platformSupportCents: number;
  applicationFeeCents: number;
  totalCheckoutCents: number;
  creatorGrossCents: number;
  creatorNetBeforeStripeCents: number;
  buyerServiceFeeBps: number;
  creatorPlatformFeeBps: number;
  buyerServiceFeeMinimumCents: number;
  creatorPlatformFeeMinimumCents: number;
};

const DEFAULT_BUYER_SERVICE_FEE_BPS = 500;
const DEFAULT_CREATOR_PLATFORM_FEE_BPS = 500;
const DEFAULT_BUYER_SERVICE_FEE_MINIMUM_CENTS = 100;
const DEFAULT_CREATOR_PLATFORM_FEE_MINIMUM_CENTS = 150;

const assertWholeCents = (label: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a whole-cent amount.`);
  }
};

const getPercentageFeeCents = ({
  amountCents,
  feeBps,
  minimumCents,
}: {
  amountCents: number;
  feeBps: number;
  minimumCents: number;
}): number => {
  if (amountCents <= 0) {
    return 0;
  }

  return Math.max(Math.ceil((amountCents * feeBps) / 10_000), minimumCents);
};

export const getCreatorHubPaymentFeeBreakdown = ({
  baseAmountCents,
  creatorTipCents = 0,
  platformSupportCents = 0,
  buyerServiceFeeBps = DEFAULT_BUYER_SERVICE_FEE_BPS,
  creatorPlatformFeeBps = DEFAULT_CREATOR_PLATFORM_FEE_BPS,
  buyerServiceFeeMinimumCents = DEFAULT_BUYER_SERVICE_FEE_MINIMUM_CENTS,
  creatorPlatformFeeMinimumCents = DEFAULT_CREATOR_PLATFORM_FEE_MINIMUM_CENTS,
}: CreatorHubPaymentFeeInput): CreatorHubPaymentFeeBreakdown => {
  assertWholeCents("Base amount", baseAmountCents);
  assertWholeCents("Creator tip", creatorTipCents);
  assertWholeCents("CreatorHub support", platformSupportCents);
  assertWholeCents("Buyer service fee minimum", buyerServiceFeeMinimumCents);
  assertWholeCents(
    "Creator platform fee minimum",
    creatorPlatformFeeMinimumCents,
  );

  if (!Number.isInteger(buyerServiceFeeBps) || buyerServiceFeeBps < 0) {
    throw new Error("Buyer service fee basis points must be a whole number.");
  }

  if (!Number.isInteger(creatorPlatformFeeBps) || creatorPlatformFeeBps < 0) {
    throw new Error("Creator platform fee basis points must be a whole number.");
  }

  if (baseAmountCents <= 0) {
    throw new Error("Base amount must be greater than zero.");
  }

  const buyerServiceFeeCents = getPercentageFeeCents({
    amountCents: baseAmountCents,
    feeBps: buyerServiceFeeBps,
    minimumCents: buyerServiceFeeMinimumCents,
  });

  const creatorPlatformFeeCents = getPercentageFeeCents({
    amountCents: baseAmountCents,
    feeBps: creatorPlatformFeeBps,
    minimumCents: creatorPlatformFeeMinimumCents,
  });

  const applicationFeeCents =
    buyerServiceFeeCents + creatorPlatformFeeCents + platformSupportCents;

  const totalCheckoutCents =
    baseAmountCents +
    creatorTipCents +
    buyerServiceFeeCents +
    platformSupportCents;

  return {
    baseAmountCents,
    creatorTipCents,
    buyerServiceFeeCents,
    creatorPlatformFeeCents,
    platformSupportCents,
    applicationFeeCents,
    totalCheckoutCents,
    creatorGrossCents: baseAmountCents + creatorTipCents,
    creatorNetBeforeStripeCents:
      baseAmountCents + creatorTipCents - creatorPlatformFeeCents,
    buyerServiceFeeBps,
    creatorPlatformFeeBps,
    buyerServiceFeeMinimumCents,
    creatorPlatformFeeMinimumCents,
  };
};