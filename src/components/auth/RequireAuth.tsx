import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

const RequireAuth = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-sm text-zinc-600">Loading…</div>;
  }

  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/signin" replace state={{ from: location }} />
  );
};

export default RequireAuth;