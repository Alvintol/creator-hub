import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import RequireAdminAccess from "../RequireAdminAccess";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";

vi.mock("../../hooks/useSellerAccess", () => ({
  useSellerAccess: vi.fn(),
}));

const mockUseSellerAccess = vi.mocked(useSellerAccess);

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
    vi.clearAllMocks();
  });

  it("redirects signed-out users to sign in", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: false,
      canAccessAdminRoutes: false,
    } as never);

    renderRoute();

    expect(screen.getByText(/sign in page/i)).toBeInTheDocument();
  });

  it("redirects signed-in non-admin users to home", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      canAccessAdminRoutes: false,
    } as never);

    renderRoute();

    expect(screen.getByText(/home page/i)).toBeInTheDocument();
  });

  it("renders the protected route for admins", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      canAccessAdminRoutes: true,
    } as never);

    renderRoute();

    expect(
      screen.getByText(/admin creator applications page/i)
    ).toBeInTheDocument();
  });
});