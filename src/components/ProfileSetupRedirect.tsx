import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { useMyProfile } from "../hooks/profile/useMyProfile";

// Paths that should never redirect into themselves
const shouldSkipRedirect = (pathname: string): boolean =>
  pathname === "/settings/profile" ||
  pathname === "/signin" ||
  pathname.startsWith("/auth");

// Redirects first-time users into Profile Settings once their profile exists
const ProfileSetupRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  useEffect(() => {
    if (loading || isLoading || !user || !profile) return;
    if (profile.profile_setup_seen) return;
    if (shouldSkipRedirect(location.pathname)) return;

    navigate("/settings/profile", { replace: true });
  }, [
    loading,
    isLoading,
    user,
    profile,
    location.pathname,
    navigate,
  ]);

  return null;
};

export default ProfileSetupRedirect;