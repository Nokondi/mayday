import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/context/AuthContext.js", () => ({
  useAuth: vi.fn(),
}));

import { Footer } from "../../../src/components/layout/Footer.js";
import { useAuth } from "../../../src/context/AuthContext.js";

const mockedUseAuth = vi.mocked(useAuth);

type AuthState = Partial<ReturnType<typeof useAuth>>;

function setAuth(state: AuthState = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...state,
  } as ReturnType<typeof useAuth>);
}

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

describe("Footer", () => {
  beforeEach(() => {
    setAuth();
  });

  it("renders as a contentinfo landmark", () => {
    renderFooter();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it('renders the "Built with love for community" attribution with screen-reader text', () => {
    renderFooter();
    // The heart icon has aria-hidden; the word "love" is provided via sr-only.
    expect(screen.getByText(/built with/i)).toBeInTheDocument();
    const srLove = screen.getByText("love");
    expect(srLove).toHaveClass("sr-only");
    expect(screen.getByText(/for community/i)).toBeInTheDocument();
  });

  it("renders the product name", () => {
    renderFooter();
    expect(screen.getByText("MayDay Mutual Aid Hub")).toBeInTheDocument();
  });

  it("hides the support link when logged out", () => {
    renderFooter();
    expect(
      screen.queryByRole("link", { name: /help|bug report/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the support link pointing to /support when logged in", () => {
    setAuth({
      user: {
        id: "u1",
        email: "a@b.com",
        name: "Alice",
        role: "USER",
        avatarUrl: null,
      } as never,
    });
    renderFooter();
    const link = screen.getByRole("link", { name: /Follow us on Patreon/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.patreon.com/c/MayDayCreative/membership",
    );
  });
});
