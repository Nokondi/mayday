import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../src/api/organizations.js', () => ({
  listMyOrganizations: vi.fn(),
}));
vi.mock('../../../src/api/communities.js', () => ({
  listMyCommunities: vi.fn(),
}));

import { listMyCommunities } from '../../../src/api/communities.js';
import { listMyOrganizations } from '../../../src/api/organizations.js';
import { PostForm } from '../../../src/components/posts/PostForm.js';
import { useAuth } from '../../../src/context/AuthContext.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedListMyOrganizations = vi.mocked(listMyOrganizations);
const mockedListMyCommunities = vi.mocked(listMyCommunities);

function setAuth(user: { id: string; name: string } | null = { id: 'u1', name: 'Alice' }) {
  mockedUseAuth.mockReturnValue({
    user: user && { ...user, email: 'a@b.com', role: 'USER', avatarUrl: null },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function renderForm(
  overrides: Partial<Parameters<typeof PostForm>[0]> = {},
): {
  onSubmit: ReturnType<typeof vi.fn>;
  fileInput: HTMLInputElement;
  container: HTMLElement;
} {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <PostForm onSubmit={onSubmit} isSubmitting={false} {...overrides} />
      </QueryClientProvider>
    </IntlProvider>,
  );
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  return { onSubmit, fileInput, container: utils.container };
}

// react-hook-form registers inputs with `name=` but the PostForm's <label>s
// are siblings, not htmlFor-linked — so getByLabelText won't find them.
// Query by name attribute instead.
function getField<T extends HTMLElement>(container: HTMLElement, name: string): T {
  const el = container.querySelector(`[name="${name}"]`) as T | null;
  if (!el) throw new Error(`No form control found with name="${name}"`);
  return el;
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
  mockedListMyOrganizations.mockResolvedValue([]);
  mockedListMyCommunities.mockResolvedValue([]);
  // jsdom does not implement object URLs; the form creates previews with them.
  (URL.createObjectURL as unknown) = vi.fn((f: Blob) => `blob:${(f as File).name ?? 'x'}`);
  (URL.revokeObjectURL as unknown) = vi.fn();
  // No geocoding during tests unless a specific test sets this up.
  globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => [] }) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PostForm — basic rendering & defaults', () => {
  it('renders the main fields', () => {
    const { container } = renderForm();
    expect(getField(container, 'title')).toBeInTheDocument();
    expect(getField(container, 'description')).toBeInTheDocument();
    expect(getField(container, 'category')).toBeInTheDocument();
    expect(getField(container, 'urgency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create post/i })).toBeInTheDocument();
  });

  it('defaults the type select to "REQUEST"', () => {
    const { container } = renderForm();
    const typeSelect = getField<HTMLSelectElement>(container, 'type');
    expect(typeSelect).toHaveValue('REQUEST');
    // All four types are offered as options.
    expect(within(typeSelect).getByRole('option', { name: /i need help/i })).toHaveValue('REQUEST');
    expect(within(typeSelect).getByRole('option', { name: /i can help/i })).toHaveValue('OFFER');
    expect(within(typeSelect).getByRole('option', { name: /i'm organizing/i })).toHaveValue('EVENT');
    expect(within(typeSelect).getByRole('option', { name: /i'm sharing an update/i })).toHaveValue('COMMS');
  });

  it('defaults the urgency select to MEDIUM', () => {
    const { container } = renderForm();
    expect(getField(container, 'urgency')).toHaveValue('MEDIUM');
  });

  it('title and description placeholders reference all post types', () => {
    renderForm();
    // Placeholders should not imply a subset of post types now that events and comms exist.
    expect(screen.getByPlaceholderText(/are organizing, or want to share/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/request, offer, event, or update/i)).toBeInTheDocument();
  });

  it('disables the submit button when isSubmitting is true', () => {
    renderForm({ isSubmitting: true });
    const submit = screen.getByRole('button', { name: /creating/i });
    expect(submit).toBeDisabled();
  });
});

describe('PostForm — organization and community selects', () => {
  it('does not render the "Post as" select when the user has no organizations', async () => {
    mockedListMyOrganizations.mockResolvedValue([]);
    const { container } = renderForm();
    await waitFor(() => expect(mockedListMyOrganizations).toHaveBeenCalled());
    expect(container.querySelector('select[name="organizationId"]')).toBeNull();
  });

  it('renders the "Post as" select with the user name as the default option', async () => {
    mockedListMyOrganizations.mockResolvedValue([
      { id: 'o1', name: 'Red Cross' } as never,
    ]);
    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('select[name="organizationId"]')).not.toBeNull();
    });
    const select = getField<HTMLSelectElement>(container, 'organizationId');
    const defaultOption = within(select).getByRole('option', { name: 'Alice' });
    expect(defaultOption).toHaveValue('');
    expect(within(select).getByRole('option', { name: 'Red Cross' })).toHaveValue('o1');
  });

  it('falls back to "Yourself" when no auth user is available', async () => {
    setAuth(null);
    mockedListMyOrganizations.mockResolvedValue([
      { id: 'o1', name: 'Red Cross' } as never,
    ]);
    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('select[name="organizationId"]')).not.toBeNull();
    });
    const select = getField<HTMLSelectElement>(container, 'organizationId');
    expect(within(select).getByRole('option', { name: 'Yourself' })).toHaveValue('');
  });

  it('always renders the audience dropdown with a Friends option, even with no communities', async () => {
    const { container } = renderForm();
    await waitFor(() => expect(mockedListMyCommunities).toHaveBeenCalled());
    const select = container.querySelector('#post-community') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(within(select).getByRole('option', { name: 'Friends' })).toBeInTheDocument();
    // Public by default until something is picked.
    expect(screen.getByText(/public — visible to everyone/i)).toBeInTheDocument();
  });

  it('lists both Friends and the user\'s communities as options', async () => {
    mockedListMyCommunities.mockResolvedValue([
      { id: 'c1', name: 'Neighbors' } as never,
    ]);
    const { container } = renderForm();
    await waitFor(() => {
      const select = container.querySelector('#post-community') as HTMLSelectElement;
      expect(within(select).queryByRole('option', { name: 'Neighbors' })).not.toBeNull();
    });
    const select = container.querySelector('#post-community') as HTMLSelectElement;
    expect(within(select).getByRole('option', { name: 'Friends' })).toHaveValue('__friends__');
    expect(within(select).getByRole('option', { name: 'Neighbors' })).toHaveValue('c1');
  });

  it('selecting Friends adds a chip and submits sharedWithFriends=true', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();
    await waitFor(() => expect(mockedListMyCommunities).toHaveBeenCalled());
    const select = container.querySelector('#post-community') as HTMLSelectElement;
    await user.selectOptions(select, '__friends__');

    expect(screen.getByRole('button', { name: /remove friends/i })).toBeInTheDocument();
    expect(screen.getByText(/visible only to the friends and communities you select/i)).toBeInTheDocument();
    // Friends can only be added once — the option leaves the dropdown.
    expect(within(select).queryByRole('option', { name: 'Friends' })).toBeNull();

    await user.type(getField(container, 'title'), 'Need food');
    await user.type(getField(container, 'description'), 'Short on supplies today');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');
    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [data] = onSubmit.mock.calls[0];
    expect(data.sharedWithFriends).toBe(true);
  });

  it('supports selecting Friends and a community together (union audience)', async () => {
    const user = userEvent.setup();
    const NEIGHBORS_ID = '00000000-0000-4000-a000-000000000001';
    mockedListMyCommunities.mockResolvedValue([
      { id: NEIGHBORS_ID, name: 'Neighbors' } as never,
    ]);
    const { onSubmit, container } = renderForm();
    await waitFor(() => {
      const select = container.querySelector('#post-community') as HTMLSelectElement;
      expect(within(select).queryByRole('option', { name: 'Neighbors' })).not.toBeNull();
    });
    const select = container.querySelector('#post-community') as HTMLSelectElement;
    await user.selectOptions(select, '__friends__');
    await user.selectOptions(select, NEIGHBORS_ID);

    expect(screen.getByRole('button', { name: /remove friends/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove neighbors/i })).toBeInTheDocument();

    await user.type(getField(container, 'title'), 'Need food');
    await user.type(getField(container, 'description'), 'Short on supplies today');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');
    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [data] = onSubmit.mock.calls[0];
    expect(data.sharedWithFriends).toBe(true);
    expect(data.communityIds).toEqual([NEIGHBORS_ID]);
  });

  it('removes a chip when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const NEIGHBORS_ID = '00000000-0000-4000-a000-000000000001';
    mockedListMyCommunities.mockResolvedValue([
      { id: NEIGHBORS_ID, name: 'Neighbors' } as never,
    ]);
    const { container } = renderForm();
    await waitFor(() => {
      const select = container.querySelector('#post-community') as HTMLSelectElement;
      expect(within(select).queryByRole('option', { name: 'Neighbors' })).not.toBeNull();
    });
    const select = container.querySelector('#post-community') as HTMLSelectElement;
    await user.selectOptions(select, NEIGHBORS_ID);

    await user.click(screen.getByRole('button', { name: /remove neighbors/i }));

    expect(screen.queryByRole('button', { name: /remove neighbors/i })).not.toBeInTheDocument();
    // The community returns to the dropdown as a selectable option.
    expect(within(select).getByRole('option', { name: 'Neighbors' })).toBeInTheDocument();
  });
});

describe('PostForm — edit mode', () => {
  function makePost(overrides: Record<string, unknown> = {}) {
    return {
      id: 'p1',
      type: 'OFFER',
      title: 'Existing title',
      description: 'Existing description',
      category: 'Food',
      urgency: 'HIGH',
      status: 'OPEN',
      location: null,
      latitude: null,
      longitude: null,
      startAt: null,
      endAt: null,
      recurrenceFreq: null,
      recurrenceInterval: null,
      sharedWithFriends: false,
      images: [],
      communities: [],
      ...overrides,
    };
  }

  it('prefills the fields from the post and shows a "Save Changes" button', () => {
    const { container } = renderForm({ initialPost: makePost() as never });
    expect(getField<HTMLInputElement>(container, 'title')).toHaveValue('Existing title');
    expect(getField<HTMLTextAreaElement>(container, 'description')).toHaveValue('Existing description');
    expect(getField<HTMLSelectElement>(container, 'category')).toHaveValue('Food');
    expect(getField<HTMLSelectElement>(container, 'urgency')).toHaveValue('HIGH');
    expect(getField<HTMLSelectElement>(container, 'type')).toHaveValue('OFFER');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('hides the audience controls (post-as and visibility) since they are fixed at creation', async () => {
    mockedListMyOrganizations.mockResolvedValue([{ id: 'o1', name: 'Red Cross' } as never]);
    mockedListMyCommunities.mockResolvedValue([{ id: 'c1', name: 'Neighbors' } as never]);
    const { container } = renderForm({ initialPost: makePost() as never });
    await waitFor(() => expect(mockedListMyCommunities).toHaveBeenCalled());
    expect(container.querySelector('select[name="organizationId"]')).toBeNull();
    expect(container.querySelector('#post-community')).toBeNull();
  });

  it('renders existing images and queues removed ones for deletion on submit', async () => {
    const user = userEvent.setup();
    const post = makePost({
      images: [
        { id: 'img-1', url: 'https://cdn.example/1.png', order: 0 },
        { id: 'img-2', url: 'https://cdn.example/2.png', order: 1 },
      ],
    });
    const { onSubmit } = renderForm({ initialPost: post as never });

    expect(screen.getByAltText(/current image 1/i)).toHaveAttribute('src', 'https://cdn.example/1.png');
    expect(screen.getByAltText(/current image 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove image 1/i }));
    // One image remains; positions re-index, so the survivor is now "image 1".
    expect(screen.queryByAltText(/current image 2/i)).not.toBeInTheDocument();
    expect(screen.getByAltText(/current image 1/i)).toHaveAttribute('src', 'https://cdn.example/2.png');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [, images, removeImageIds] = onSubmit.mock.calls[0];
    expect(images).toEqual([]);
    expect(removeImageIds).toEqual(['img-1']);
  });
});

describe('PostForm — validation', () => {
  it('does not call onSubmit when required fields are missing', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: /create post/i }));

    // Give react-hook-form + zod async validation time to settle.
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits cleaned data and image files when all required fields are valid', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();

    await user.type(getField(container, 'title'), 'Need food');
    await user.type(getField(container, 'description'), 'Short on supplies today');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');

    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data, images] = onSubmit.mock.calls[0];
    expect(data).toMatchObject({
      type: 'REQUEST',
      urgency: 'MEDIUM',
      title: 'Need food',
      description: 'Short on supplies today',
      category: 'Food',
    });
    // No org/community selected: the form converts '' / empty to undefined.
    expect(data.organizationId).toBeUndefined();
    expect(data.communityIds).toBeUndefined();
    expect(images).toEqual([]);
  });

  it('rejects an event without a start date and shows the validation message', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();

    await user.selectOptions(getField<HTMLSelectElement>(container, 'type'), 'EVENT');
    await user.type(getField(container, 'title'), 'Community potluck');
    await user.type(getField(container, 'description'), 'Bring a dish to share');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');

    await user.click(screen.getByRole('button', { name: /create post/i }));

    expect(await screen.findByText(/events need a start date/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits an event once a start date is provided', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();

    await user.selectOptions(getField<HTMLSelectElement>(container, 'type'), 'EVENT');
    await user.type(getField(container, 'title'), 'Community potluck');
    await user.type(getField(container, 'description'), 'Bring a dish to share');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');
    fireEvent.change(getField(container, 'startAt'), {
      target: { value: '2026-08-01T17:00' },
    });

    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data).toMatchObject({ type: 'EVENT', title: 'Community potluck' });
    expect(data.startAt).toBeTruthy();
  });

  it('submits a comms post without requiring a start date', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();

    await user.selectOptions(getField<HTMLSelectElement>(container, 'type'), 'COMMS');
    await user.type(getField(container, 'title'), 'Water main work downtown');
    await user.type(getField(container, 'description'), 'Expect lane closures through Friday');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Other');

    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data).toMatchObject({ type: 'COMMS', title: 'Water main work downtown' });
    expect(data.startAt).toBeUndefined();
  });
});

describe('PostForm — image uploads', () => {
  it('renders a preview for each selected image with a remove button', async () => {
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const img1 = new File(['a'], 'a.png', { type: 'image/png' });
    const img2 = new File(['b'], 'b.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [img1, img2] } });

    await waitFor(() => {
      expect(screen.getByAltText(/upload preview 1/i)).toBeInTheDocument();
      expect(screen.getByAltText(/upload preview 2/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /remove image 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove image 2/i })).toBeInTheDocument();
  });

  it('removes a preview when its remove button is clicked', async () => {
    const user = userEvent.setup();
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] },
    });
    await screen.findByAltText(/upload preview 1/i);

    await user.click(screen.getByRole('button', { name: /remove image 1/i }));

    expect(screen.queryByAltText(/upload preview 1/i)).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('caps the number of images at 5 and hides the "Add images" button when full', async () => {
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const files = Array.from({ length: 7 }, (_, i) =>
      new File([String(i)], `img${i}.png`, { type: 'image/png' }),
    );
    fireEvent.change(fileInput, { target: { files } });

    await waitFor(() => {
      expect(screen.getByAltText(/upload preview 5/i)).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/upload preview 6/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add images/i })).not.toBeInTheDocument();
  });

  it('passes selected images to onSubmit on valid form submission', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const img = new File(['a'], 'a.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [img] } });
    await screen.findByAltText(/upload preview 1/i);

    await user.type(getField(container, 'title'), 'Title');
    await user.type(getField(container, 'description'), 'Enough description here');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');
    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [, images] = onSubmit.mock.calls[0];
    expect(images).toEqual([img]);
  });
});
