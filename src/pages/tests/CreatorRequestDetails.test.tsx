import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorRequestDetails from "../creator/CreatorRequestDetails";

const mocks = vi.hoisted(() => ({
  useCreatorRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  createAgreement: vi.fn(),
  sendDraftAgreement: vi.fn(),
  useListingRequestAgreement: vi.fn(),
  useListingRequestProgressUpdates: vi.fn(),
  createProgressUpdate: vi.fn(),
}));

vi.mock("../../hooks/creatorRequests/useCreatorRequest", () => ({
  useCreatorRequest: mocks.useCreatorRequest,
}));

vi.mock("../../hooks/creatorRequests/useUpdateCreatorListingRequestStatus", () => ({
  useUpdateCreatorListingRequestStatus: () => ({
    mutateAsync: mocks.updateRequestStatus,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../components/RequestConversationThread", () => ({
  default: () => <div>Conversation thread loaded</div>,
}));

vi.mock("../../hooks/creatorRequests/useListingRequestAgreement", () => ({
  useListingRequestAgreement: mocks.useListingRequestAgreement,
}));

vi.mock("../../hooks/creatorRequests/useCreateListingRequestAgreement", () => ({
  useCreateListingRequestAgreement: () => ({
    mutateAsync: mocks.createAgreement,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../components/ListingRequestAgreementSummary", () => ({
  default: ({
    agreement,
    isLoading,
  }: {
    agreement: unknown;
    isLoading?: boolean;
  }) => (
    <div>
      {isLoading
        ? "Mock agreement loading"
        : agreement
          ? "Mock agreement summary"
          : "Mock no agreement summary"}
    </div>
  ),
}));

vi.mock("../../components/ListingRequestAgreementBuilder", () => ({
  default: ({
    request,
    onCreateAgreement,
  }: {
    request: { id: string };
    onCreateAgreement: (input: { listingRequestId: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onCreateAgreement({ listingRequestId: request.id })}
    >
      Mock agreement builder
    </button>
  ),
}));

vi.mock("../../hooks/creatorRequests/useSendDraftListingRequestAgreement", () => ({
  useSendDraftListingRequestAgreement: () => ({
    mutateAsync: mocks.sendDraftAgreement,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../components/ListingRequestAgreementWorkReadinessCard", () => ({
  default: ({
    requestStatus,
    agreement,
  }: {
    requestStatus: string;
    agreement: { status: string } | null;
  }) => (
    <div>
      Mock work readiness card: {requestStatus} / {agreement?.status ?? "none"}
    </div>
  ),
}));

vi.mock(
  "../../hooks/creatorRequests/useListingRequestProgressUpdates",
  () => ({
    useListingRequestProgressUpdates:
      mocks.useListingRequestProgressUpdates,
  })
);

vi.mock(
  "../../components/ListingRequestProgressUpdateTimeline",
  () => ({
    default: ({
      updates,
      isLoading,
      error,
    }: {
      updates: Array<{ id: string }>;
      isLoading?: boolean;
      error?: unknown;
    }) => (
      <div>
        Mock progress timeline: {updates.length} /{" "}
        {isLoading ? "loading" : "ready"} /{" "}
        {error ? "error" : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useCreateListingRequestProgressUpdate",
  () => ({
    useCreateListingRequestProgressUpdate: () => ({
      mutateAsync: mocks.createProgressUpdate,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../components/ListingRequestProgressUpdateForm",
  () => ({
    default: ({
      requestStatus,
      agreement,
      onCreateProgressUpdate,
    }: {
      requestStatus: string;
      agreement: {
        id: string;
        status: string;
        starting_payment_status: string;
      } | null;
      onCreateProgressUpdate: (input: {
        agreementId: string;
        updateKind: "progress";
        title: string;
        body: string;
        progressPercent: number;
      }) => void;
    }) =>
      agreement?.status === "buyer_accepted" &&
        agreement.starting_payment_status === "paid" &&
        requestStatus === "accepted" ? (
        <button
          type="button"
          onClick={() =>
            onCreateProgressUpdate({
              agreementId: agreement.id,
              updateKind: "progress",
              title: "Initial concepts completed",
              body:
                "The first concept sketches are ready for review.",
              progressPercent: 35,
            })
          }
        >
          Mock post progress update
        </button>
      ) : null,
  })
);

const request = {
  id: "request-1",
  listing_id: "listing-1",
  buyer_user_id: "buyer-1",
  creator_user_id: "creator-1",
  status: "submitted",
  message: "Legacy request message.",
  request_title: "Custom cozy emote pack",
  request_details: "I need three cozy emotes for my Twitch channel launch.",
  requested_timeline: "Flexible, ideally before June 10.",
  budget_amount: 75,
  reference_links: ["https://example.com/reference"],
  creator_status_reason: null,
  created_at: "2026-05-17T12:00:00.000Z",
  updated_at: "2026-05-17T12:00:00.000Z",
  archived_at: null,
  archived_by_user_id: null,
  listing_snapshot: {
    listing_id: "listing-1",
    creator_user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    offering_type: "commission",
    category: "emotes",
    video_subtype: null,
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    deliverables: ["3 emotes", "PNG files"],
    tags: ["emotes"],
    preview_url: null,
    fulfilment_mode: "request",
    status: "published",
    is_active: true,
    updated_at: "2026-05-09T12:00:00.000Z",
  },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/creator/requests/request-1"]}>
      <Routes>
        <Route
          path="/creator/requests/:id"
          element={<CreatorRequestDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("<CreatorRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request,
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.updateRequestStatus.mockResolvedValue(undefined);

    mocks.useListingRequestAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestProgressUpdates.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it("renders structured buyer request details for the creator", () => {
    renderPage();

    expect(screen.getByText("Custom cozy emote pack")).toBeInTheDocument();
    expect(
      screen.getByText("I need three cozy emotes for my Twitch channel launch.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Flexible, ideally before June 10.")
    ).toBeInTheDocument();
    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/reference")).toHaveAttribute(
      "href",
      "https://example.com/reference"
    );

    expect(screen.getByText("@buyeruser")).toBeInTheDocument();
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });

  it("renders the agreement builder for an accepted request without an agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Mock no agreement summary")).toBeInTheDocument();
    expect(screen.getByText("Mock agreement builder")).toBeInTheDocument();
  });

  it("creates an agreement from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen.getByRole("button", { name: "Mock agreement builder" }).click();

    expect(mocks.createAgreement).toHaveBeenCalledWith({
      listingRequestId: "request-1",
    });
  });

  it("does not render the agreement builder when an agreement already exists", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Mock agreement summary")).toBeInTheDocument();
    expect(screen.queryByText("Mock agreement builder")).not.toBeInTheDocument();
  });

  it("sends a draft agreement from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "draft",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen.getByRole("button", { name: "Send draft to buyer" }).click();

    expect(mocks.sendDraftAgreement).toHaveBeenCalledWith({
      agreementId: "agreement-1",
    });
  });

  it("passes accepted request and buyer accepted agreement state into the work readiness card", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText("Mock work readiness card: accepted / buyer_accepted")
    ).toBeInTheDocument();
  });

  it("renders progress updates after the buyer accepts the agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestProgressUpdates.mockReturnValue({
      data: [
        {
          id: "progress-update-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock progress timeline: 1 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("does not render progress updates before the buyer accepts the agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "sent",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(/Mock progress timeline:/)
    ).not.toBeInTheDocument();
  });

  it("posts a progress update from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock post progress update",
      })
      .click();

    expect(
      mocks.createProgressUpdate
    ).toHaveBeenCalledWith({
      agreementId: "agreement-1",
      updateKind: "progress",
      title: "Initial concepts completed",
      body:
        "The first concept sketches are ready for review.",
      progressPercent: 35,
    });
  });

  it("does not show the progress update form while starting payment is required", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "payment_required",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByRole("button", {
        name: "Mock post progress update",
      })
    ).not.toBeInTheDocument();
  });

});