export type TwitchStream = {
  login: string;
  displayName: string;
  isLive: true;
  title: string;
  gameName: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
};

// Normalizes a Twitch login for consistent lookups
// - trims surrounding whitespace
// - lowercases the value
// - removes a leading @ if present
export const normalizeTwitchLogin = (value: string): string =>
  value.trim().toLowerCase().replace(/^@+/, "");