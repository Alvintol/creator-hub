import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import CookieConsent from "../legal/CookieConsent";
import type { OptionalCookieCategory } from "../../domain/legal/cookiePreferences";
import {
  COOKIE_PREFERENCES_STORAGE_KEY,
  readCookiePreferences,
} from "../../lib/legal/cookiePreferencesStorage";
import CookiePreferencesProvider, {
  useCookiePreferences,
} from "../../providers/CookiePreferencesProvider";

const OpenSettings = () => {
  const { openSettings } = useCookiePreferences();
  return (
    <button type="button" onClick={openSettings}>
      Open settings
    </button>
  );
};

const renderConsent = (activeCategories: OptionalCookieCategory[]) =>
  render(
    <MemoryRouter>
      <CookiePreferencesProvider activeCategories={activeCategories}>
        <OpenSettings />
        <CookieConsent />
      </CookiePreferencesProvider>
    </MemoryRouter>,
  );

describe("CookieConsent", () => {
  afterEach(() => {
    window.localStorage.removeItem(COOKIE_PREFERENCES_STORAGE_KEY);
  });

  it("shows no banner while no optional category is active", () => {
    renderConsent([]);

    expect(screen.queryByRole("region", { name: "Cookie choices" })).not.toBeInTheDocument();
  });

  it("explains in settings that nothing optional is in use", () => {
    renderConsent([]);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(screen.getByRole("dialog", { name: "Cookie settings" })).toHaveTextContent(
      /doesn.t use any optional cookies/i,
    );
    expect(screen.queryByRole("button", { name: "Accept optional" })).not.toBeInTheDocument();
  });

  it("offers reject, accept and manage with equal weight once a category is active", () => {
    renderConsent(["analytics"]);

    const reject = screen.getByRole("button", { name: "Reject optional" });
    const accept = screen.getByRole("button", { name: "Accept optional" });
    const manage = screen.getByRole("button", { name: "Manage choices" });

    expect(reject.className).toBe(accept.className);
    expect(accept.className).toBe(manage.className);
  });

  it("remembers a refusal and hides the banner", () => {
    renderConsent(["analytics"]);

    fireEvent.click(screen.getByRole("button", { name: "Reject optional" }));

    expect(screen.queryByRole("region", { name: "Cookie choices" })).not.toBeInTheDocument();
    expect(readCookiePreferences()).toMatchObject({
      offeredCategories: ["analytics"],
      categories: { analytics: false },
    });
  });

  it("records acceptance of the active categories", () => {
    renderConsent(["analytics"]);

    fireEvent.click(screen.getByRole("button", { name: "Accept optional" }));

    expect(readCookiePreferences()?.categories).toMatchObject({ analytics: true, advertising: false });
  });

  it("starts individual choices unchecked and saves them", () => {
    renderConsent(["analytics", "externalMedia"]);

    fireEvent.click(screen.getByRole("button", { name: "Manage choices" }));

    const analytics = screen.getByRole("checkbox", { name: /Analytics/ });
    const media = screen.getByRole("checkbox", { name: /External media/ });

    expect(analytics).not.toBeChecked();
    expect(media).not.toBeChecked();

    fireEvent.click(media);
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(readCookiePreferences()?.categories).toMatchObject({
      analytics: false,
      externalMedia: true,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes settings with Escape without recording a choice", () => {
    renderConsent(["analytics"]);

    fireEvent.click(screen.getByRole("button", { name: "Manage choices" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readCookiePreferences()).toBeNull();
    expect(screen.getByRole("region", { name: "Cookie choices" })).toBeInTheDocument();
  });
});
