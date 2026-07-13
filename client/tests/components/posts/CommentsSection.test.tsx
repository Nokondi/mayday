import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentWithAuthor } from "@mayday/shared";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../src/context/AuthContext.js", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../src/api/comments.js", () => ({
  getComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { useAuth } from "../../../src/context/AuthContext.js";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from "../../../src/api/comments.js";
import { CommentsSection } from "../../../src/components/posts/CommentsSection.js";

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetComments = vi.mocked(getComments);
const mockedCreateComment = vi.mocked(createComment);
const mockedUpdateComment = vi.mocked(updateComment);
const mockedDeleteComment = vi.mocked(deleteComment);

const USER_ID = "u1";
const OTHER_ID = "u2";

function setAuth(id: string | null) {
  mockedUseAuth.mockReturnValue({
    user: id
      ? { id, email: "me@example.com", name: "Me", role: "USER", avatarUrl: null }
      : null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function makeComment(overrides: Partial<CommentWithAuthor> = {}): CommentWithAuthor {
  return {
    id: "c1",
    postId: "p1",
    authorId: OTHER_ID,
    body: "Great post",
    editedAt: null,
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
    author: {
      id: OTHER_ID,
      name: "Bob",
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      links: null,
      createdAt: "2020-01-01T00:00:00Z",
    },
    ...overrides,
  };
}

function renderSection(props: { canModerate?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" defaultLocale="en">
        <MemoryRouter>
          <CommentsSection postId="p1" canModerate={props.canModerate ?? false} />
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(USER_ID);
  mockedGetComments.mockResolvedValue([]);
});

describe("CommentsSection — rendering", () => {
  it("shows the empty state when there are no comments", async () => {
    mockedGetComments.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("renders fetched comments", async () => {
    mockedGetComments.mockResolvedValue([
      makeComment({ id: "c1", body: "First!" }),
      makeComment({ id: "c2", body: "Second" }),
    ]);
    renderSection();
    expect(await screen.findByText("First!")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it('shows an "(edited)" tag for an edited comment', async () => {
    mockedGetComments.mockResolvedValue([
      makeComment({ editedAt: "2020-01-02T00:00:00Z" }),
    ]);
    renderSection();
    expect(await screen.findByText(/\(edited\)/i)).toBeInTheDocument();
  });
});

describe("CommentsSection — composing", () => {
  it("posts a new comment via createComment", async () => {
    const user = userEvent.setup();
    mockedGetComments.mockResolvedValue([]);
    mockedCreateComment.mockResolvedValue(makeComment({ authorId: USER_ID }));
    renderSection();

    await screen.findByText(/no comments yet/i);
    await user.type(
      screen.getByPlaceholderText(/add a comment/i),
      "My new comment",
    );
    await user.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() =>
      expect(mockedCreateComment).toHaveBeenCalledWith("p1", "My new comment"),
    );
  });

  it("does not render the composer for anonymous users", async () => {
    setAuth(null);
    mockedGetComments.mockResolvedValue([]);
    renderSection();
    await screen.findByText(/no comments yet/i);
    expect(
      screen.queryByPlaceholderText(/add a comment/i),
    ).not.toBeInTheDocument();
  });
});

describe("CommentsSection — edit and delete permissions", () => {
  it("lets the comment author edit their own comment", async () => {
    const user = userEvent.setup();
    mockedGetComments.mockResolvedValue([
      makeComment({ authorId: USER_ID, body: "Mine" }),
    ]);
    mockedUpdateComment.mockResolvedValue(
      makeComment({ authorId: USER_ID, body: "Edited" }),
    );
    renderSection();

    await screen.findByText("Mine");
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const editor = screen.getByDisplayValue("Mine");
    await user.clear(editor);
    await user.type(editor, "Edited");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(mockedUpdateComment).toHaveBeenCalledWith("p1", "c1", "Edited"),
    );
  });

  it("hides edit for comments by other users", async () => {
    mockedGetComments.mockResolvedValue([makeComment({ authorId: OTHER_ID })]);
    renderSection();
    await screen.findByText("Great post");
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
  });

  it("shows delete on another user's comment when the viewer can moderate", async () => {
    const user = userEvent.setup();
    mockedGetComments.mockResolvedValue([makeComment({ authorId: OTHER_ID })]);
    mockedDeleteComment.mockResolvedValue(undefined);
    renderSection({ canModerate: true });

    await screen.findByText("Great post");
    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(mockedDeleteComment).toHaveBeenCalledWith("p1", "c1"),
    );
  });

  it("hides delete on another user's comment when the viewer cannot moderate", async () => {
    mockedGetComments.mockResolvedValue([makeComment({ authorId: OTHER_ID })]);
    renderSection({ canModerate: false });
    await screen.findByText("Great post");
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });
});
