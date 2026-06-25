import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../providers/AuthProvider";

type CreateListingRequestPaymentCheckoutInput = {
  paymentId: string;
};

type ListingRequestPaymentCheckoutResponse = {
  payment: {
    id: string;
    status: string;
    stripe_connected_account_id: string;
    stripe_checkout_session_id: string;
  };
  checkout: {
    sessionId: string;
    clientSecret: string;
  };
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

const getJsonResponse = async <Data,>(response: Response): Promise<Data> => {
  const json = (await response.json()) as Data & { error?: string };

  if (!response.ok) {
    throw new Error(json.error || `Stripe checkout failed (${response.status})`);
  }

  return json;
};

export const useCreateListingRequestPaymentCheckout = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();

  return useMutation({
    mutationKey: ["createListingRequestPaymentCheckout", user?.id ?? null],
    mutationFn: async ({
      paymentId,
    }: CreateListingRequestPaymentCheckoutInput): Promise<ListingRequestPaymentCheckoutResponse> => {
      const token = session?.access_token;

      if (!token) {
        throw new Error("You must be signed in to open checkout.");
      }

      const response = await fetch(`${getApiBase()}/api/stripe/checkout/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentId }),
      });

      return getJsonResponse<ListingRequestPaymentCheckoutResponse>(response);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["listingRequestPayments"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["listingRequestPayment", data.payment.id],
      });
    },
  });
};