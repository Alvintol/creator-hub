import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { clientEnv } from "./env";

const stripePromiseByConnectedAccount = new Map<
  string,
  Promise<Stripe | null>
>();

export const getStripePublishableKeyMissingMessage = (): string =>
  `Stripe ${clientEnv.stripeKeyMode} publishable key is not configured.`;

export const getStripePublishableKey = (): string =>
  clientEnv.stripePublishableKey.trim();

export const getStripeForConnectedAccount = (
  connectedAccountId: string,
): Promise<Stripe | null> => {
  const publishableKey = getStripePublishableKey();

  if (!publishableKey) {
    throw new Error(getStripePublishableKeyMissingMessage());
  }

  const stripeAccount = connectedAccountId.trim();

  if (!stripeAccount) {
    throw new Error("Stripe connected account is required.");
  }

  const cacheKey = `${publishableKey}:${stripeAccount}`;
  const cachedPromise = stripePromiseByConnectedAccount.get(cacheKey);

  if (cachedPromise) {
    return cachedPromise;
  }

  const stripePromise = loadStripe(publishableKey, {
    stripeAccount,
  });

  stripePromiseByConnectedAccount.set(cacheKey, stripePromise);

  return stripePromise;
};