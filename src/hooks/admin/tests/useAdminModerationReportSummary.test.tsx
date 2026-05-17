import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminModerationReportSummary } from "../useAdminModerationReportSummary";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

const createRpcSuccess = <Data,>(data: Data) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: "OK",
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useAdminModerationReportSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.rpc.mockResolvedValue(
      createRpcSuccess([
        {
          submitted_count: 3,
          active_count: 5,
          resolved_count: 8,
          unread_reporter_update_count: 2,
          profile_under_review_count: 1,
          hidden_listing_count: 4,
        },
      ])
    );
  });

  it("loads admin moderation summary counts from the RPC", async () => {
    const { result } = renderHook(() => useAdminModerationReportSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "get_admin_moderation_report_summary"
    );

    expect(result.current.data).toEqual({
      submitted_count: 3,
      active_count: 5,
      resolved_count: 8,
      unread_reporter_update_count: 2,
      profile_under_review_count: 1,
      hidden_listing_count: 4,
    });
  });

  it("normalises missing summary values to zero", async () => {
    mocks.rpc.mockResolvedValueOnce(createRpcSuccess([{}]));

    const { result } = renderHook(() => useAdminModerationReportSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      submitted_count: 0,
      active_count: 0,
      resolved_count: 0,
      unread_reporter_update_count: 0,
      profile_under_review_count: 0,
      hidden_listing_count: 0,
    });
  });
});