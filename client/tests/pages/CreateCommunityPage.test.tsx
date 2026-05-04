import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/api/communities.js', () => ({
  createCommunity: vi.fn(),
  inviteToCommunity: vi.fn(),
  uploadCommunityAvatar: vi.fn(),
}));

import { toast } from 'sonner';
import {
  createCommunity,
  inviteToCommunity,
  uploadCommunityAvatar,
} from '../../src/api/communities.js';
import { CreateCommunityPage } from '../../src/pages/CreateCommunityPage.js';

const mockedToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockedCreateCommunity = vi.mocked(createCommunity);
const mockedInviteToCommunity = vi.mocked(inviteToCommunity);
const mockedUploadCommunityAvatar = vi.mocked(uploadCommunityAvatar);

function getHiddenFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected a hidden file input in the document');
  }
  return input;
}

function makeImage(name = 'avatar.png', type = 'image/png', sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/communities/new']}>
        <Routes>
          <Route path="/communities/new" element={<CreateCommunityPage />} />
          <Route path="/communities/:id" element={<div>COMMUNITY DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (URL.createObjectURL as unknown) = vi.fn(
    (f: Blob) => `blob:${(f as File).name ?? 'x'}`,
  );
  (URL.revokeObjectURL as unknown) = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateCommunityPage — avatar picker rendering', () => {
  it('shows the "Add avatar" button when nothing is selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add avatar/i })).toBeInTheDocument();
    expect(screen.queryByAltText(/avatar preview/i)).not.toBeInTheDocument();
  });

  it('shows a preview and a remove button after a file is picked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(getHiddenFileInput(), makeImage());

    const preview = await screen.findByAltText(/avatar preview/i);
    expect(preview).toHaveAttribute('src', expect.stringMatching(/^blob:/));
    expect(screen.getByRole('button', { name: /remove avatar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add avatar/i })).not.toBeInTheDocument();
  });

  it('clears the preview and revokes the blob URL when remove is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(getHiddenFileInput(), makeImage());
    await user.click(await screen.findByRole('button', { name: /remove avatar/i }));

    expect(screen.queryByAltText(/avatar preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add avatar/i })).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('CreateCommunityPage — avatar picker validation', () => {
  it('rejects disallowed mime types with an error toast and no preview', () => {
    renderPage();

    fireEvent.change(getHiddenFileInput(), {
      target: { files: [new File(['x'], 'malware.exe', { type: 'application/x-msdownload' })] },
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.stringMatching(/jpeg.*png.*gif.*webp/i),
    );
    expect(screen.queryByAltText(/avatar preview/i)).not.toBeInTheDocument();
  });

  it('rejects files larger than 5MB with an error toast and no preview', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(getHiddenFileInput(), makeImage('huge.png', 'image/png', 5 * 1024 * 1024 + 1));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/5MB/i));
    });
    expect(screen.queryByAltText(/avatar preview/i)).not.toBeInTheDocument();
  });
});

describe('CreateCommunityPage — submission flow', () => {
  it('creates the community without calling uploadCommunityAvatar when no avatar was picked', async () => {
    const user = userEvent.setup();
    mockedCreateCommunity.mockResolvedValueOnce({
      id: 'c-1',
      name: 'Eastside',
    } as never);

    renderPage();
    await user.type(screen.getByLabelText(/^name$/i), 'Eastside');
    await user.click(screen.getByRole('button', { name: /create community/i }));

    await waitFor(() => {
      expect(mockedCreateCommunity).toHaveBeenCalledTimes(1);
    });
    expect(mockedCreateCommunity.mock.calls[0][0]).toEqual({ name: 'Eastside' });
    expect(mockedUploadCommunityAvatar).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith('Community created');
    });
  });

  it('uploads the avatar after the community is created, using the returned id and selected file', async () => {
    const user = userEvent.setup();
    const file = makeImage('logo.png');
    mockedCreateCommunity.mockResolvedValueOnce({
      id: 'c-42',
      name: 'Eastside',
    } as never);
    mockedUploadCommunityAvatar.mockResolvedValueOnce({} as never);

    renderPage();
    await user.upload(getHiddenFileInput(), file);
    await user.type(screen.getByLabelText(/^name$/i), 'Eastside');
    await user.click(screen.getByRole('button', { name: /create community/i }));

    await waitFor(() => {
      expect(mockedUploadCommunityAvatar).toHaveBeenCalledTimes(1);
    });
    expect(mockedUploadCommunityAvatar.mock.calls[0]).toEqual(['c-42', file]);
    const createOrder = mockedCreateCommunity.mock.invocationCallOrder[0];
    const uploadOrder = mockedUploadCommunityAvatar.mock.invocationCallOrder[0];
    expect(uploadOrder).toBeGreaterThan(createOrder);
  });

  it('still creates the community and surfaces a discrete error toast when the avatar upload fails', async () => {
    const user = userEvent.setup();
    mockedCreateCommunity.mockResolvedValueOnce({
      id: 'c-1',
      name: 'Eastside',
    } as never);
    mockedUploadCommunityAvatar.mockRejectedValueOnce(new Error('S3 down'));

    renderPage();
    await user.upload(getHiddenFileInput(), makeImage());
    await user.type(screen.getByLabelText(/^name$/i), 'Eastside');
    await user.click(screen.getByRole('button', { name: /create community/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/avatar upload failed/i),
      );
    });
    expect(mockedToast.success).toHaveBeenCalledWith('Community created');
    expect(await screen.findByText('COMMUNITY DETAIL')).toBeInTheDocument();
    // Sanity: the inviteToCommunity mock was not called since no emails were entered.
    expect(mockedInviteToCommunity).not.toHaveBeenCalled();
  });
});
