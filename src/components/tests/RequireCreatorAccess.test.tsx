import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import RequireCreatorAccess from "../RequireCreatorAccess";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";

vi.mock("../../hooks/creatorApplication/useSellerAccess", () => ({
  useSellerAccess: vi.fn(),
}));

const mockUseSellerAccess = vi.mocked(useSellerAccess);

type MockSellerAccess = ReturnType<typeof useSellerAccess>;

const makeSellerAccess = (
  overrides: Partial<MockSellerAccess> = {}
): MockSellerAccess =>
  ({
    isLoading: false,
    isSignedIn: false,
    isAdmin: false,
    isCreatorApproved: false,
    profileReady: true,
    hasLinkedCreatorPlatform: false,
    canAccessCreatorRoutes: false,
    canAccessAdminRoutes: false,
    sellerApplication: null,
    creatorStatusLabel: "Not applied",
    ...overrides,
  }) as MockSellerAccess;

describe("RequireCreatorAccess", () => {
  beforeEach(() => {
    mockUseSellerAccess.mockReset();
  });

  it("redirects signed-out users to sign in", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: false,
      })
    );

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <Routes>
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route path="/apply/creator" element={<div>Apply page</div>} />
          <Route element={<RequireCreatorAccess />}>
            <Route path="/creator/dashboard" element={<div>Protected page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Sign in page")).toBeInTheDocument();
  });

  it("redirects signed-in non-approved users to the creator application flow", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: true,
        canAccessCreatorRoutes: false,
      })
    );

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <Routes>
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route path="/apply/creator" element={<div>Apply page</div>} />
          <Route element={<RequireCreatorAccess />}>
            <Route path="/creator/dashboard" element={<div>Protected page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Apply page")).toBeInTheDocument();
  });

  it("renders the protected route for approved creators", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: true,
        isCreatorApproved: true,
        canAccessCreatorRoutes: true,
        creatorStatusLabel: "Approved creator",
      })
    );

    render(
      <MemoryRouter initialEntries={["/creator/dashboard"]}>
        <Routes>
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route path="/apply/creator" element={<div>Apply page</div>} />
          <Route element={<RequireCreatorAccess />}>
            <Route path="/creator/dashboard" element={<div>Protected page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected page")).toBeInTheDocument();
  });
});