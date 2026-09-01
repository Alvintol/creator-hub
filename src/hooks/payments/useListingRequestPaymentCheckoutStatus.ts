import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestPaymentCheckoutStatus = {
  payment: {
    id: string;
    status: string;
    payment_type: string;
    currency: string;
    base_amount_cents: number;
    creator_tip_cents: number;
    buyer_service_fee_cents: number;
    creator_platform_fee_cents: number;
    platform_support_cents: number;
    application_fee_cents: number;
    total_checkout_cents: number;
    payer_user_id: string;
    creator_user_id: string;
    stripe_connected_account_id: string;
    stripe_checkout_session_id: string;
    paid_at: string | null;
    updated_at: string;
  };
  checkout: {
    sessionId: string;
    status: string;
    paymentStatus: string;
    customerEmail: string | null;
  };
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

const getJsonResponse = async <Data,>(response: Response): Promise<Data> => {
  const json = (await response.json()) as Data & { error?: string };

  if (!response.ok) {
    throw new Error(json.error || `Stripe session lookup failed (${response.status})`);
  }

  return json;
};

const fetchListingRequestPaymentCheckoutStatus = async ({
  paymentId,
  sessionId,
  token,
}: {
  paymentId: string;
  sessionId: string;
  token: string;
}): Promise<ListingRequestPaymentCheckoutStatus> => {
  const params = new URLSearchParams({
    paymentId,
    sessionId,
  });

  const response = await fetch(
    `${getApiBase()}/api/stripe/checkout/session-status?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return getJsonResponse<ListingRequestPaymentCheckoutStatus>(response);
};

export const useListingRequestPaymentCheckoutStatus = ({
  paymentId,
  sessionId,
}: {
  paymentId: string | null;
  sessionId: string | null;
}) => {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["listingRequestPaymentCheckoutStatus", paymentId, sessionId],
    enabled: Boolean(paymentId && sessionId && token),
    queryFn: () =>
      fetchListingRequestPaymentCheckoutStatus({
        paymentId: paymentId ?? "",
        sessionId: sessionId ?? "",
        token: token ?? "",
      }),
  });
};