import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateModerationReportStatus } from "../useUpdateModerationReportStatus";
import {
  moderationReportResolutionOptions,
  moderationReportStatusOptions,
  type ModerationReportResolutionCode,
  type ModerationReportStatus,
} from "../../../domain/moderation/moderationReports";

const createRpcSuccess = <Data,>(data: Data) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: "OK",
});

const testResolutionCode =
  moderationReportResolutionOptions[0]?.value as ModerationReportResolutionCode;

const testOpenStatus =
  moderationReportStatusOptions.find((option) => option.value !== "resolved")
    ?.value as ModerationReportStatus;

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
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

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUpdateModerationReportStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.rpc.mockResolvedValue(
      createRpcSuccess({
        report_id: "report-1",
        previous_status: testOpenStatus,
        new_status: "resolved",
        previous_resolution_code: null,
        new_resolution_code: testResolutionCode,
        resolved_at: "2026-05-10T12:00:00.000Z",
        changed: true,
      })
    );
  });

  it("passes reporter-visible updates and admin notes to the RPC", async () => {
    const { result } = renderHook(() => useUpdateModerationReportStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      reportId: "report-1",
      status: "resolved",
      resolutionCode: testResolutionCode,
      reporterStatusMessage: "Thanks. We completed our review.",
      adminNotes: "Confirmed violation and hid the listing.",
    });

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "update_moderation_report_status",
        {
          p_report_id: "report-1",
          p_status: "resolved",
          p_resolution_code: testResolutionCode,
          p_reporter_status_message: "Thanks. We completed our review.",
          p_admin_notes: "Confirmed violation and hid the listing.",
        }
      );
    });
  });

  it("normalises empty optional fields to null", async () => {
    const { result } = renderHook(() => useUpdateModerationReportStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      reportId: "report-1",
      status: testOpenStatus,
      resolutionCode: "",
      reporterStatusMessage: "",
      adminNotes: "",
    });

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "update_moderation_report_status",
        {
          p_report_id: "report-1",
          p_status: testOpenStatus,
          p_resolution_code: null,
          p_reporter_status_message: null,
          p_admin_notes: null,
        }
      );
    });
  });
});