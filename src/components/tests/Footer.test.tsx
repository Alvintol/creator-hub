import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "../Footer";
import { describe, expect, it } from 'vitest';

describe("<Footer />", () => {
  it("renders CreatorHub text", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/CreatorHub/i)).toBeInTheDocument();
  });
});