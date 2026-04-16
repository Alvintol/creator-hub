import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import RequireCreatorAccess from "../RequireCreatorAccess";
import { useSellerAccess } from "../../hooks/useSellerAccess";

vi.mock("../../hooks/useSellerAccess", () => ({
  useSellerAccess: vi.fn(),
}));

const mockUseSellerAccess = vi.mocked(useSellerAccess);

const renderRoute = () => {
  render(
    <MemoryRouter initialEntries={["/creator/dashboard"]}>
      <Routes>
        <Route element={<RequireCreatorAccess />}>
          <Route
            path="/creator/dashboard"
            element={<div>Creator dashboard page</div>}
          />
        </Route>

        <Route path="/signin" element={<div>Sign in page</div>} />
        <Route path="/apply/creator" element={<div>Apply creator page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("RequireCreatorAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects signed-out users to sign in", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: false,
      canAccessCreatorRoutes: false,
    } as never);

    renderRoute();

    expect(screen.getByText(/sign in page/i)).toBeInTheDocument();
  });

  it("redirects signed-in non-approved users to the creator application flow", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      canAccessCreatorRoutes: false,
    } as never);

    renderRoute();

    expect(screen.getByText(/apply creator page/i)).toBeInTheDocument();
  });

  it("renders the protected route for approved creators", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      canAccessCreatorRoutes: true,
    } as never);

    renderRoute();

    expect(screen.getByText(/creator dashboard page/i)).toBeInTheDocument();
  });
});