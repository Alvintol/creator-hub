import { describe, expect, it } from "vitest";

import { cookiePolicyVersion } from "../legal/cookiePolicy";
import {
  acceptOfferedCategories,
  activeOptionalCookieCategories,
  createCookiePreferences,
  hasCookieConsent,
  isCookieChoiceCurrent,
  needsCookieChoice,
  noOptionalCategories,
} from "../legal/cookiePreferences";

const decidedAt = Date.UTC(2026, 0, 15);

describe("cookie preferences", () => {
  it("has no optional categories active today", () => {
    expect(activeOptionalCookieCategories).toEqual([]);
  });

  it("does not ask for a choice while nothing optional is active", () => {
    expect(needsCookieChoice(null, [])).toBe(false);
  });

  it("asks when an optional category becomes active", () => {
    expect(needsCookieChoice(null, ["analytics"])).toBe(true);
  });

  it("defaults every optional category to off", () => {
    expect(Object.values(noOptionalCategories).every((value) => value === false)).toBe(true);
  });

  it("stamps the policy version and expires six months later", () => {
    const preferences = createCookiePreferences(noOptionalCategories, ["analytics"], decidedAt);

    expect(preferences.policyVersion).toBe(cookiePolicyVersion);
    expect(preferences.expiresAt).toBe(Date.UTC(2026, 6, 15));
    expect(isCookieChoiceCurrent(preferences, Date.UTC(2026, 6, 14))).toBe(true);
    expect(isCookieChoiceCurrent(preferences, Date.UTC(2026, 6, 15))).toBe(false);
  });

  it("remembers a refusal as a choice", () => {
    const preferences = createCookiePreferences(noOptionalCategories, ["analytics"], decidedAt);

    expect(needsCookieChoice(preferences, ["analytics"], decidedAt + 1)).toBe(false);
    expect(hasCookieConsent(preferences, "analytics", decidedAt + 1)).toBe(false);
  });

  it("grants consent only for an accepted, offered category", () => {
    const preferences = createCookiePreferences(
      acceptOfferedCategories(["analytics"]),
      ["analytics"],
      decidedAt,
    );

    expect(hasCookieConsent(preferences, "analytics", decidedAt + 1)).toBe(true);
    expect(hasCookieConsent(preferences, "advertising", decidedAt + 1)).toBe(false);
  });

  it("cannot accept a category that was not offered", () => {
    const preferences = createCookiePreferences(
      { ...noOptionalCategories, advertising: true },
      ["analytics"],
      decidedAt,
    );

    expect(preferences.categories.advertising).toBe(false);
  });

  it("asks again when a new category is added after the choice", () => {
    const preferences = createCookiePreferences(
      acceptOfferedCategories(["analytics"]),
      ["analytics"],
      decidedAt,
    );

    expect(needsCookieChoice(preferences, ["analytics", "advertising"], decidedAt + 1)).toBe(true);
  });

  it("stops honouring a choice made under another policy version", () => {
    const preferences = {
      ...createCookiePreferences(acceptOfferedCategories(["analytics"]), ["analytics"], decidedAt),
      policyVersion: "2020-01-01-old",
    };

    expect(hasCookieConsent(preferences, "analytics", decidedAt + 1)).toBe(false);
    expect(needsCookieChoice(preferences, ["analytics"], decidedAt + 1)).toBe(true);
  });
});
