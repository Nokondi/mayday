import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    user: user && { ...user, email: 'a@b.com', role: 'USER' },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
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
    <QueryClientProvider client={queryClient}>
      <PostForm onSubmit={onSubmit} isSubmitting={false} {...overrides} />
    </QueryClientProvider>,
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
  global.fetch = vi.fn().mockResolvedValue({ json: async () => [] }) as never;
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

  it('defaults the type radio to "REQUEST"', () => {
    renderForm();
    const requestRadio = screen.getByRole('radio', { name: /i need help/i });
    const offerRadio = screen.getByRole('radio', { name: /i can help/i });
    expect(requestRadio).toBeChecked();
    expect(offerRadio).not.toBeChecked();
  });

  it('defaults the urgency select to MEDIUM', () => {
    const { container } = renderForm();
    expect(getField(container, 'urgency')).toHaveValue('MEDIUM');
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

  it('does not render the visibility select when the user has no communities', async () => {
    const { container } = renderForm();
    await waitFor(() => expect(mockedListMyCommunities).toHaveBeenCalled());
    expect(container.querySelector('select[name="communityId"]')).toBeNull();
  });

  it('renders the visibility select with a Public default when communities exist', async () => {
    mockedListMyCommunities.mockResolvedValue([
      { id: 'c1', name: 'Neighbors' } as never,
    ]);
    const { container } = renderForm();
    await waitFor(() => {
      expect(container.querySelector('select[name="communityId"]')).not.toBeNull();
    });
    const select = getField<HTMLSelectElement>(container, 'communityId');
    expect(
      within(select).getByRole('option', { name: /public \(visible to everyone\)/i }),
    ).toHaveValue('');
    expect(
      within(select).getByRole('option', { name: /neighbors members only/i }),
    ).toHaveValue('c1');
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
    // No org/community selected: the form converts '' to undefined.
    expect(data.organizationId).toBeUndefined();
    expect(data.communityId).toBeUndefined();
    expect(images).toEqual([]);
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
      expect(screen.getByAltText(/preview of image 1/i)).toBeInTheDocument();
      expect(screen.getByAltText(/preview of image 2/i)).toBeInTheDocument();
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
    await screen.findByAltText(/preview of image 1/i);

    await user.click(screen.getByRole('button', { name: /remove image 1/i }));

    expect(screen.queryByAltText(/preview of image 1/i)).not.toBeInTheDocument();
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
      expect(screen.getByAltText(/preview of image 5/i)).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/preview of image 6/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add images/i })).not.toBeInTheDocument();
  });

  it('passes selected images to onSubmit on valid form submission', async () => {
    const user = userEvent.setup();
    const { onSubmit, container } = renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const img = new File(['a'], 'a.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [img] } });
    await screen.findByAltText(/preview of image 1/i);

    await user.type(getField(container, 'title'), 'Title');
    await user.type(getField(container, 'description'), 'Enough description here');
    await user.selectOptions(getField<HTMLSelectElement>(container, 'category'), 'Food');
    await user.click(screen.getByRole('button', { name: /create post/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [, images] = onSubmit.mock.calls[0];
    expect(images).toEqual([img]);
  });
});
