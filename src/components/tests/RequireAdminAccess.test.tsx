import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import RequireAdminAccess from "../RequireAdminAccess";
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
    canStartApplication: false,
    canEditApplication: false,
    canSubmitApplication: false,
    error: null,
    ...overrides,
  }) as MockSellerAccess;

const renderRoute = () => {
  render(
    <MemoryRouter initialEntries={["/admin/creator-applications"]}>
      <Routes>
        <Route element={<RequireAdminAccess />}>
          <Route
            path="/admin/creator-applications"
            element={<div>Admin creator applications page</div>}
          />
        </Route>

        <Route path="/signin" element={<div>Sign in page</div>} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("RequireAdminAccess", () => {
  beforeEach(() => {
    mockUseSellerAccess.mockReset();
  });

  it("redirects signed-out users to sign in", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: false,
        canAccessAdminRoutes: false,
      })
    );

    renderRoute();

    expect(screen.getByText(/sign in page/i)).toBeInTheDocument();
  });

  it("redirects signed-in non-admin users to home", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: true,
        isAdmin: false,
        canAccessAdminRoutes: false,
      })
    );

    renderRoute();

    expect(screen.getByText(/home page/i)).toBeInTheDocument();
  });

  it("renders the protected route for admins", () => {
    mockUseSellerAccess.mockReturnValue(
      makeSellerAccess({
        isSignedIn: true,
        isAdmin: true,
        canAccessAdminRoutes: true,
      })
    );

    renderRoute();

    expect(
      screen.getByText(/admin creator applications page/i)
    ).toBeInTheDocument();
  });
});