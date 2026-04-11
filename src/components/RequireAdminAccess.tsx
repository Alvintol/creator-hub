import { Navigate, Outlet } from "react-router-dom";
import { useSellerAccess } from "../hooks/useSellerAccess";

const RequireAdminAccess = () => {
  const { isLoading, isSignedIn, canAccessAdminRoutes } = useSellerAccess();

  if (isLoading) return <div className="text-sm text-zinc-600">Loading…</div>;
  if (!isSignedIn) return <Navigate to="/signin" replace />;

  return canAccessAdminRoutes ? <Outlet /> : <Navigate to="/" replace />;
};

export default RequireAdminAccess;