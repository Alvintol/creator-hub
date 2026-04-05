import type { ProfileRow } from "../hooks/useMyProfile";
import type { ProfilePlatformAccountRow } from "../hooks/useProfilePlatformAccounts";

// Returns the best available avatar URL for a user profile
// Priority:
// 1) manual CreatorHub avatar upload (future)
// 2) linked Twitch avatar from metadata
export const getProfileAvatarUrl = (
  profile: ProfileRow | null | undefined,
  twitchAccount?: ProfilePlatformAccountRow | null
): string | null => {
  if (profile?.avatar_url) return profile.avatar_url;

  const metadata = twitchAccount?.metadata;
  if (!metadata || typeof metadata !== "object") return null;

  const profileImageUrl =
    "profile_image_url" in metadata ? metadata.profile_image_url : null;

  return typeof profileImageUrl === "string" && profileImageUrl.trim()
    ? profileImageUrl
    : null;
};