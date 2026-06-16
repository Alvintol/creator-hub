import { Navigate, Outlet } from "react-router-dom";
import { useSellerAccess } from "../hooks/creatorApplication/useSellerAccess";

const RequireCreatorAccess = () => {
  const { isLoading, isSignedIn, canAccessCreatorRoutes } = useSellerAccess();

  if (isLoading) {
    return <div className="text-sm text-zinc-600">Loading…</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/signin" replace />;
  }

  return canAccessCreatorRoutes ? (
    <Outlet />
  ) : (
    <Navigate to="/apply/creator" replace />
  );
};

export default RequireCreatorAccess;