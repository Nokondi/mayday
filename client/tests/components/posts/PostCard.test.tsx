import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { PostWithAuthor } from "@mayday/shared";
import { PostCard } from "../../../src/components/posts/PostCard.js";

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: "p1",
    type: "REQUEST",
    status: "OPEN",
    title: "Need help",
    description: "Some description",
    category: "Food",
    location: null,
    latitude: null,
    longitude: null,
    urgency: "MEDIUM",
    authorId: "u1",
    organizationId: null,
    communityId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
    author: {
      id: "u1",
      name: "Alice",
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      createdAt: "2020-01-01T00:00:00Z",
    },
    organization: null,
    community: null,
    ...overrides,
  };
}

function renderCard(post: PostWithAuthor) {
  return render(
    <MemoryRouter>
      <PostCard post={post} />
    </MemoryRouter>,
  );
}

describe("PostCard — basic rendering", () => {
  it("links to the post detail page", () => {
    renderCard(makePost({ id: "abc123" }));
    const links = screen.getAllByRole("link");
    // The outer card is the first link; its href is /posts/:id.
    expect(links[0]).toHaveAttribute("href", "/posts/abc123");
  });

  it("renders the title and description", () => {
    renderCard(
      makePost({ title: "Need groceries", description: "Short on funds" }),
    );
    expect(
      screen.getByRole("heading", { name: "Need groceries" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Short on funds")).toBeInTheDocument();
  });

  it("renders the CategoryBadge and UrgencyBadge", () => {
    renderCard(makePost({ category: "Housing", urgency: "HIGH" }));
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it('shows a relative-time line ending in "ago"', () => {
    renderCard(makePost());
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });
});

describe("PostCard — type label and styling", () => {
  it('labels request posts as "Request" with orange accents', () => {
    const { container } = renderCard(makePost({ type: "REQUEST" }));
    expect(screen.getByText("Request")).toBeInTheDocument();
    // The outer link carries the left-border color.
    const card = container.querySelector("a");
    expect(card).toHaveClass("border-l-orange-700");
  });

  it('labels offer posts as "Offer" with green accents', () => {
    const { container } = renderCard(makePost({ type: "OFFER" }));
    expect(screen.getByText("Offer")).toBeInTheDocument();
    const card = container.querySelector("a");
    expect(card).toHaveClass("border-l-green-700");
  });
});

describe("PostCard — author vs organization attribution", () => {
  it("shows only the author when there is no organization", () => {
    renderCard(
      makePost({
        author: {
          id: "u1",
          name: "Alice",
          bio: null,
          location: null,
          skills: [],
          avatarUrl: null,
          createdAt: "2020-01-01T00:00:00Z",
        },
      }),
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows the organization name when posted by an org", () => {
    renderCard(
      makePost({
        organization: { id: "o1", name: "Red Cross", avatarUrl: null },
        author: {
          id: "u1",
          name: "Alice",
          bio: null,
          location: null,
          skills: [],
          avatarUrl: null,
          createdAt: "2020-01-01T00:00:00Z",
        },
      }),
    );
    expect(screen.getByText("Red Cross")).toBeInTheDocument();
  });
});

describe("PostCard — status badges", () => {
  it('shows a "Fulfilled" badge when the post status is FULFILLED', () => {
    renderCard(makePost({ status: "FULFILLED" }));
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
  });

  it('shows a "Closed" badge when the post status is CLOSED', () => {
    renderCard(makePost({ status: "CLOSED" }));
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("does not show a status badge when the post is OPEN", () => {
    renderCard(makePost({ status: "OPEN" }));
    expect(screen.queryByText("Fulfilled")).not.toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });
});

describe("PostCard — community badge", () => {
  it("renders the community name when the post is scoped to a community", () => {
    renderCard(
      makePost({ community: { id: "c1", name: "Neighborhood Watch" } }),
    );
    expect(screen.getByText("Neighborhood Watch")).toBeInTheDocument();
  });

  it("does not render a community badge when community is null", () => {
    renderCard(makePost({ community: null }));
    expect(screen.queryByText("Neighborhood Watch")).not.toBeInTheDocument();
  });
});

describe("PostCard — image preview", () => {
  it("renders the first image when images exist, with an alt that references the title", () => {
    renderCard(
      makePost({
        title: "Bike for offer",
        images: [
          { id: "i1", url: "https://example.com/a.jpg", order: 0 },
          { id: "i2", url: "https://example.com/b.jpg", order: 1 },
        ],
      }),
    );
    const img = screen.getByAltText(/bike for offer/i) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/a.jpg");
  });

  it("does not render an image when the post has no images", () => {
    const { container } = renderCard(makePost({ images: [] }));
    expect(container.querySelector("img")).toBeNull();
  });
});

// The outer card is itself a <Link>, so its accessible name includes every
// text inside it (location included). These helpers find only the *inner*
// location-related link by its href pattern rather than by accessible name.
function findMapLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>('a[href^="/map"]');
}
function findCardLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>('a[href^="/posts/"]');
}

describe("PostCard — location rendering", () => {
  it("renders the location as plain text", () => {
    const { container } = renderCard(
      makePost({ location: "Somewhere", latitude: null, longitude: null }),
    );
    expect(screen.getByText("Somewhere")).toBeInTheDocument();
    expect(findMapLink(container)).toBeNull();
  });

  it("renders nothing for location when location is null", () => {
    const { container } = renderCard(makePost({ location: null }));
    expect(findMapLink(container)).toBeNull();
    // Also sanity-check: no stray location string left over from the default.
    expect(screen.queryByText(/little rock/i)).not.toBeInTheDocument();
  });
});

describe("PostCard — schedule rendering", () => {
  it("does not render a schedule when both startAt and endAt are null", () => {
    renderCard(makePost({ startAt: null, endAt: null }));
    // No "Starts" / "Ends" / en-dash range text anywhere.
    expect(screen.queryByText(/starts/i)).toBeNull();
    expect(screen.queryByText(/ends/i)).toBeNull();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('renders "Starts <date>" when only startAt is set', () => {
    renderCard(makePost({ startAt: "2026-06-10T14:00:00Z", endAt: null }));
    expect(screen.getByText(/starts jun 10/i)).toBeInTheDocument();
  });

  it('renders "Ends <date>" when only endAt is set', () => {
    renderCard(makePost({ startAt: null, endAt: "2026-06-10T14:00:00Z" }));
    expect(screen.getByText(/ends jun 10/i)).toBeInTheDocument();
  });

  it('renders a single-day range as "Jun 10, 10:00 AM – 12:00 PM" when start and end are on the same day', () => {
    renderCard(
      makePost({
        // Pick times that land on the same calendar day in every US timezone.
        startAt: "2026-06-10T16:00:00Z",
        endAt: "2026-06-10T18:00:00Z",
      }),
    );
    // Both times on the same day → only one date prefix in the output.
    const matches = screen.getAllByText(/jun 10/i);
    expect(matches).toHaveLength(1);
    expect(matches[0].textContent).toMatch(/jun 10.*–/i);
  });

  it("renders a multi-day range with both dates when start and end are on different days", () => {
    renderCard(
      makePost({
        startAt: "2026-06-10T16:00:00Z",
        endAt: "2026-06-12T16:00:00Z",
      }),
    );
    const el = screen.getByText(/jun 10/i);
    expect(el.textContent).toMatch(/jun 10/i);
    expect(el.textContent).toMatch(/jun 12/i);
  });
});

describe("PostCard — recurrence rendering", () => {
  it('renders "every week" when freq is WEEK and interval is 1', () => {
    renderCard(
      makePost({
        startAt: "2026-06-10T14:00:00Z",
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      }),
    );
    expect(screen.getByText("every week")).toBeInTheDocument();
  });

  it("pluralizes the unit when the interval is greater than 1", () => {
    renderCard(
      makePost({
        startAt: "2026-06-10T14:00:00Z",
        recurrenceFreq: "WEEK",
        recurrenceInterval: 2,
      }),
    );
    expect(screen.getByText("every 2 weeks")).toBeInTheDocument();
  });

  it("handles DAY and MONTH units", () => {
    const { unmount } = renderCard(
      makePost({
        startAt: "2026-06-10T14:00:00Z",
        recurrenceFreq: "DAY",
        recurrenceInterval: 3,
      }),
    );
    expect(screen.getByText("every 3 days")).toBeInTheDocument();
    unmount();
    renderCard(
      makePost({
        startAt: "2026-06-10T14:00:00Z",
        recurrenceFreq: "MONTH",
        recurrenceInterval: 1,
      }),
    );
    expect(screen.getByText("every month")).toBeInTheDocument();
  });

  it("does not render recurrence text when freq is null", () => {
    renderCard(
      makePost({
        startAt: "2026-06-10T14:00:00Z",
        recurrenceFreq: null,
        recurrenceInterval: null,
      }),
    );
    expect(screen.queryByText(/every /)).toBeNull();
  });
});
