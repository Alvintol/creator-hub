import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CookieConsent from "../legal/CookieConsent";
import Footer from "../layout/Footer";
import CookiePreferencesProvider from "../../providers/CookiePreferencesProvider";
import { describe, expect, it } from 'vitest';

describe("<Footer />", () => {
  it("renders Made for Stream text", () => {
    render(
      <MemoryRouter>
        <CookiePreferencesProvider>
          <Footer />
        </CookiePreferencesProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Made for Stream/i)).toBeInTheDocument();
  });

  it("opens Cookie settings from the footer", () => {
    render(
      <MemoryRouter>
        <CookiePreferencesProvider>
          <Footer />
          <CookieConsent />
        </CookiePreferencesProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(screen.getByRole("dialog", { name: "Cookie settings" })).toBeInTheDocument();
  });
});