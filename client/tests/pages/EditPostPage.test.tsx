import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/api/posts.js', () => ({
  getPost: vi.fn(),
  updatePost: vi.fn(),
}));

// Stub the form so the page test stays focused on loading, the auth gate, and
// the mutation/navigation. The stub surfaces the prefill prop and fires submit.
vi.mock('../../src/components/posts/PostForm.js', () => ({
  PostForm: ({
    initialPost,
    onSubmit,
  }: {
    initialPost?: { title: string };
    onSubmit: (data: unknown, images: File[], removeImageIds: string[]) => Promise<void>;
  }) => (
    <div>
      <div data-testid="initial-title">{initialPost?.title}</div>
      <button
        type="button"
        onClick={() => onSubmit({ title: 'Edited' }, [], ['img-1'])}
      >
        stub-save
      </button>
    </div>
  ),
}));

import { useAuth } from '../../src/context/AuthContext.js';
import { getPost, updatePost } from '../../src/api/posts.js';
import { EditPostPage } from '../../src/pages/EditPostPage.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetPost = vi.mocked(getPost);
const mockedUpdatePost = vi.mocked(updatePost);

function setAuth(user: { id: string; role: string } | null) {
  mockedUseAuth.mockReturnValue({
    user: user && { ...user, email: 'a@b.com', name: 'Alice', avatarUrl: null },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function makePost(overrides: Record<string, unknown> = {}) {
  return { id: 'p1', title: 'Existing title', authorId: 'u1', ...overrides };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/posts/p1/edit']}>
          <Routes>
            <Route path="/posts/:id/edit" element={<EditPostPage />} />
            <Route path="/posts/:id" element={<div>POST DETAIL</div>} />
            <Route path="/" element={<div>POSTS LIST</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditPostPage', () => {
  it('loads the post and hands it to the form as initialPost', async () => {
    setAuth({ id: 'u1', role: 'USER' });
    mockedGetPost.mockResolvedValueOnce(makePost() as never);
    renderPage();

    expect(await screen.findByTestId('initial-title')).toHaveTextContent('Existing title');
  });

  it('redirects a non-owner non-admin back to the post detail', async () => {
    setAuth({ id: 'u2', role: 'USER' });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByText('POST DETAIL')).toBeInTheDocument();
    expect(screen.queryByTestId('initial-title')).not.toBeInTheDocument();
  });

  it('lets an admin edit a post they do not own', async () => {
    setAuth({ id: 'admin1', role: 'ADMIN' });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByTestId('initial-title')).toBeInTheDocument();
  });

  it('submits the edit (with images and removeImageIds) and navigates to the post', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u1', role: 'USER' });
    mockedGetPost.mockResolvedValueOnce(makePost() as never);
    mockedUpdatePost.mockResolvedValueOnce(makePost({ title: 'Edited' }) as never);
    renderPage();

    await user.click(await screen.findByRole('button', { name: /stub-save/i }));

    await waitFor(() =>
      expect(mockedUpdatePost).toHaveBeenCalledWith('p1', { title: 'Edited' }, [], ['img-1']),
    );
    expect(await screen.findByText('POST DETAIL')).toBeInTheDocument();
  });
});
