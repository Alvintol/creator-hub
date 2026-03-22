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

export const normalizeTwitchLogin = (login: string): string =>
  login.trim().toLowerCase();