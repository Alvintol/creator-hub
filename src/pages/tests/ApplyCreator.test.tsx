import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApplyCreator from "../ApplyCreator";
import { useAuth } from "../../providers/AuthProvider";
import { useSellerAccess } from "../../hooks/useSellerAccess";
import { useUpsertMySellerApplication } from "../../hooks/useUpsertMySellerApplication";
import { useCreatorApplicationQueueState } from "../../hooks/useCreatorApplicationQueueState";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );

  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  };
});

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../hooks/useSellerAccess", () => ({
  useSellerAccess: vi.fn(),
}));

vi.mock("../../hooks/useUpsertMySellerApplication", () => ({
  useUpsertMySellerApplication: vi.fn(),
}));

vi.mock("../../hooks/useCreatorApplicationQueueState", () => ({
  useCreatorApplicationQueueState: vi.fn(),
}));

type SellerApplicationSampleRow = {
  id: string;
  application_id: string;
  sample_type: "link" | "image" | "video";
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const mockUseAuth = vi.mocked(useAuth);
const mockUseSellerAccess = vi.mocked(useSellerAccess);
const mockUseUpsertMySellerApplication = vi.mocked(useUpsertMySellerApplication);
const mockUseCreatorApplicationQueueState = vi.mocked(
  useCreatorApplicationQueueState
);
const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);
const mockUseQueryClient = vi.mocked(useQueryClient);

const buildSample = (
  overrides?: Partial<SellerApplicationSampleRow>
): SellerApplicationSampleRow => ({
  id: overrides?.id ?? crypto.randomUUID(),
  application_id: overrides?.application_id ?? "application-1",
  sample_type: overrides?.sample_type ?? "link",
  title: overrides?.title ?? "Portfolio sample",
  description: overrides?.description ?? "Example work",
  url: overrides?.url ?? "https://example.com/sample",
  storage_path: overrides?.storage_path ?? null,
  file_name: overrides?.file_name ?? null,
  mime_type: overrides?.mime_type ?? null,
  file_size_bytes: overrides?.file_size_bytes ?? null,
  sort_order: overrides?.sort_order ?? 0,
  created_at: overrides?.created_at ?? "2026-04-01T00:00:00.000Z",
  updated_at: overrides?.updated_at ?? "2026-04-01T00:00:00.000Z",
});

const buildRequiredRecentUploadSample = (
  overrides?: Partial<SellerApplicationSampleRow>
): SellerApplicationSampleRow =>
  buildSample({
    title: "Most Recent Upload/Vod",
    url: "https://youtube.com/watch?v=recent-upload",
    ...overrides,
  });

const renderPage = (samples: SellerApplicationSampleRow[]) => {
  mockUseQuery.mockReturnValue({
    data: samples,
    isLoading: false,
    error: null,
  } as never);

  render(
    <MemoryRouter>
      <ApplyCreator />
    </MemoryRouter>
  );
};

describe("ApplyCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    } as never);

    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      isAdmin: false,
      isCreatorApproved: false,
      canAccessCreatorRoutes: false,
      canAccessAdminRoutes: false,
      profileReady: true,
      hasLinkedCreatorPlatform: true,
      sellerApplication: {
        id: "application-1",
        profile_user_id: "user-1",
        status: "draft",
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        reviewer_notes: null,
        rejection_reason: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      creatorStatusLabel: "Draft",
      canStartApplication: true,
      canEditApplication: true,
      canSubmitApplication: true,
      error: null,
    } as never);

    mockUseUpsertMySellerApplication.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    mockUseCreatorApplicationQueueState.mockReturnValue({
      data: {
        openCount: 2,
        maxOpen: 10,
        remaining: 8,
        hasCapacity: true,
        isFull: false,
      },
      isLoading: false,
      error: null,
    } as never);

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    } as never);

    // ApplyCreator creates 4 local mutations.
    mockUseMutation.mockImplementation(() => {
      return {
        mutateAsync: vi.fn(),
        isPending: false,
      } as never;
    });
  });

  it("disables submit when there are fewer than 3 samples", () => {
    renderPage([
      buildRequiredRecentUploadSample({ sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Thumbnail showcase",
        url: "https://example.com/thumbs",
        sort_order: 1,
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();
  });

  it("disables submit when the required Most Recent Upload/Vod link is missing", () => {
    renderPage([
      buildSample({
        id: "sample-1",
        title: "Portfolio one",
        url: "https://example.com/one",
        sort_order: 0,
      }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
      buildSample({
        id: "sample-3",
        title: "Portfolio three",
        url: "https://example.com/three",
        sort_order: 2,
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();
  });

  it("shows the queue-full message and disables submit when the review queue is full", () => {
    mockUseCreatorApplicationQueueState.mockReturnValue({
      data: {
        openCount: 10,
        maxOpen: 10,
        remaining: 0,
        hasCapacity: false,
        isFull: true,
      },
      isLoading: false,
      error: null,
    } as never);

    renderPage([
      buildRequiredRecentUploadSample({ sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
      buildSample({
        id: "sample-3",
        title: "Portfolio three",
        url: "https://example.com/three",
        sort_order: 2,
      }),
    ]);

    const submitButton = screen.getByRole("button", {
      name: /submit for review/i,
    });

    expect(submitButton).toBeDisabled();

    expect(
      screen.getByText(/full|check again later|10\/10|queue/i)
    ).toBeInTheDocument();
  });

  it("marks the required link sample clearly and does not show a remove button for it", () => {
    renderPage([
      buildRequiredRecentUploadSample({ id: "required-link", sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
    ]);

    expect(screen.getByText(/required link sample/i)).toBeInTheDocument();

    // Only the normal sample should expose a remove button.
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(1);
  });
});