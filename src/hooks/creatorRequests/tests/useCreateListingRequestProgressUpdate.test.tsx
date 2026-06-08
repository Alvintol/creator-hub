import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useCreateListingRequestProgressUpdate } from "../useCreateListingRequestProgressUpdate";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const invalidateSpy = vi.spyOn(
    queryClient,
    "invalidateQueries"
  );

  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useCreateListingRequestProgressUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "progress-update-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          update_kind: "progress",
          title: "First progress update",
          body: "The initial sketches are now complete.",
          progress_percent: 35,
          created_at: "2026-06-06T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("creates a project progress update through the RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestProgressUpdate(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        updateKind: "progress",
        title: " First progress update ",
        body: " The initial sketches are now complete. ",
        progressPercent: 35,
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_progress_update",
      {
        p_agreement_id: "agreement-1",
        p_update_kind: "progress",
        p_title: "First progress update",
        p_body: "The initial sketches are now complete.",
        p_progress_percent: 35,
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestProgressUpdates",
        "request-1",
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["adminRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversationMessages"],
    });
  });

  it("allows updates without a progress percentage", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestProgressUpdate(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        updateKind: "delay",
        title: "Schedule update",
        body: "A scheduling issue may affect the next checkpoint.",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_progress_update",
      expect.objectContaining({
        p_update_kind: "delay",
        p_progress_percent: null,
      })
    );
  });

  it("throws when the creator is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestProgressUpdate(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        updateKind: "progress",
        title: "First progress update",
        body: "The initial sketches are now complete.",
        progressPercent: 35,
      })
    ).rejects.toThrow(
      "You must be signed in to post a progress update."
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error(
        "This agreement is not ready for progress updates."
      ),
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestProgressUpdate(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        updateKind: "progress",
        title: "First progress update",
        body: "The initial sketches are now complete.",
        progressPercent: 35,
      })
    ).rejects.toThrow(
      "This agreement is not ready for progress updates."
    );
  });

  it("throws when the RPC returns no progress update", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestProgressUpdate(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        updateKind: "progress",
        title: "First progress update",
        body: "The initial sketches are now complete.",
        progressPercent: 35,
      })
    ).rejects.toThrow(
      "The project progress update could not be created."
    );
  });
});