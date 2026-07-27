import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The form is exercised in its own test; stub it here so this test stays
// focused on the page's structural wiring (heading, sections, form slot).
vi.mock("../../src/components/support/BugReportForm.js", () => ({
  BugReportForm: () => <div data-testid="bug-report-form" />,
}));
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: vi.fn() }));

import { SupportPage } from "../../src/pages/SupportPage.js";
import { useAuth } from "../../src/context/AuthContext.js";
import { renderWithIntl } from "../helpers/renderWithIntl.js";

const mockedUseAuth = vi.mocked(useAuth);

function setAuth(user: Record<string, unknown> | null) {
  mockedUseAuth.mockReturnValue({ user, isLoading: false } as never);
}

function renderPage() {
  const client = new QueryClient();
  return renderWithIntl(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Default: logged in; the anonymous cases set null explicitly.
  setAuth({ id: "u1", name: "Alice" });
});

describe("SupportPage", () => {
  it("renders a support heading and intro", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /help with mayday/i }),
    ).toBeInTheDocument();
  });

  it("has sections for using the site, general information, and reporting a bug", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 2, name: /how to use/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /general questions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /report a bug/i }),
    ).toBeInTheDocument();
  });

  it("renders the bug report form in the bug report section", () => {
    renderPage();
    expect(screen.getByTestId("bug-report-form")).toBeInTheDocument();
  });

  it("replaces the bug report form with a login prompt when logged out", () => {
    setAuth(null);
    renderPage();
    expect(screen.queryByTestId("bug-report-form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("still shows the FAQ sections when logged out", () => {
    setAuth(null);
    renderPage();
    expect(
      screen.getByRole("heading", { level: 2, name: /how to use/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /general questions/i }),
    ).toBeInTheDocument();
  });

  it("links the FAQ's Browse reference to the public browse route", () => {
    renderPage();
    // /posts works for logged-in (redirects home) and logged-out (public
    // browse) readers alike; linking "/" would strand anonymous readers on
    // the About landing page.
    expect(screen.getByRole("link", { name: /^browse$/i })).toHaveAttribute(
      "href",
      "/posts",
    );
  });

  it("renders usage topics as collapsible details elements", () => {
    renderPage();
    // At least a few of the expected topic summaries should be present.
    expect(screen.getByText(/Requests and Offers/i)).toBeInTheDocument();
    expect(screen.getByText(/create a post/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Communities and Organizations/i),
    ).toBeInTheDocument();

    // Ensure each summary is inside a <details> element (so it's collapsible).
    const summary = screen.getByText(/create a post/i).closest("summary");
    expect(summary).not.toBeNull();
    expect(summary!.parentElement!.tagName).toBe("DETAILS");
  });

  it("renders general topics as collapsible details elements", () => {
    renderPage();
    // At least a few of the expected topic summaries should be present.
    expect(screen.getByText(/What is MayDay/i)).toBeInTheDocument();
    expect(screen.getByText(/What is mutual aid/i)).toBeInTheDocument();

    // Ensure each summary is inside a <details> element (so it's collapsible).
    const summary = screen
      .getByText(/philosophy behind MayDay/i)
      .closest("summary");
    expect(summary).not.toBeNull();
    expect(summary!.parentElement!.tagName).toBe("DETAILS");
  });
});
