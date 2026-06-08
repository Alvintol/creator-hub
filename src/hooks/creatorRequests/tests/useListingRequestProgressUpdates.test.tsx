import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useListingRequestProgressUpdates } from "../useListingRequestProgressUpdates";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

const progressUpdate = {
  id: "progress-update-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  update_kind: "progress",
  title: "Initial concepts completed",
  body: "The first concept sketches are ready for review.",
  progress_percent: 35,
  created_at: "2026-06-06T12:00:00.000Z",
  updated_at: "2026-06-06T12:00:00.000Z",
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return wrapper;
};

describe("useListingRequestProgressUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
      loading: false,
    });

    mocks.from.mockReturnValue({
      select: mocks.select,
    });

    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });

    mocks.eq.mockReturnValue({
      order: mocks.order,
    });

    mocks.order.mockResolvedValue({
      data: [progressUpdate],
      error: null,
    });
  });

  it("loads progress updates for the request newest first", async () => {
    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.from).toHaveBeenCalledWith(
      "listing_request_progress_updates"
    );

    expect(mocks.select).toHaveBeenCalledWith(
      expect.stringContaining("progress_percent")
    );

    expect(mocks.eq).toHaveBeenCalledWith(
      "listing_request_id",
      "request-1"
    );

    expect(mocks.order).toHaveBeenCalledWith(
      "created_at",
      {
        ascending: false,
      }
    );

    expect(result.current.data).toEqual([
      progressUpdate,
    ]);
  });

  it("returns an empty list when no progress updates exist", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("does not query while the user is signed out", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not query without a request id", () => {
    const { result } = renderHook(
      () => useListingRequestProgressUpdates(null),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces progress update query errors", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: new Error(
        "Progress updates could not be loaded."
      ),
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error("Progress updates could not be loaded.")
    );
  });
});