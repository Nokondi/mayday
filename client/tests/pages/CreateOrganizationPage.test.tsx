import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/api/organizations.js', () => ({
  createOrganization: vi.fn(),
  inviteToOrganization: vi.fn(),
  uploadOrganizationAvatar: vi.fn(),
}));

import { toast } from 'sonner';
import {
  createOrganization,
  inviteToOrganization,
  uploadOrganizationAvatar,
} from '../../src/api/organizations.js';
import { CreateOrganizationPage } from '../../src/pages/CreateOrganizationPage.js';

const mockedToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockedCreateOrganization = vi.mocked(createOrganization);
const mockedInviteToOrganization = vi.mocked(inviteToOrganization);
const mockedUploadOrganizationAvatar = vi.mocked(uploadOrganizationAvatar);

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
      <MemoryRouter initialEntries={['/organizations/new']}>
        <Routes>
          <Route path="/organizations/new" element={<CreateOrganizationPage />} />
          <Route path="/organizations/:id" element={<div>ORG DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom does not implement object URLs; the picker creates previews with them.
  (URL.createObjectURL as unknown) = vi.fn(
    (f: Blob) => `blob:${(f as File).name ?? 'x'}`,
  );
  (URL.revokeObjectURL as unknown) = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateOrganizationPage — avatar picker rendering', () => {
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

describe('CreateOrganizationPage — avatar picker validation', () => {
  it('rejects disallowed mime types with an error toast and no preview', () => {
    renderPage();

    // Drive the change event directly: userEvent.upload would filter on the
    // input's `accept` attribute before the component's validation runs.
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

describe('CreateOrganizationPage — submission flow', () => {
  it('creates the org without calling uploadOrganizationAvatar when no avatar was picked', async () => {
    const user = userEvent.setup();
    mockedCreateOrganization.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Acme',
    } as never);

    renderPage();
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Acme');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(mockedCreateOrganization).toHaveBeenCalledTimes(1);
    });
    expect(mockedCreateOrganization.mock.calls[0][0]).toEqual({ name: 'Acme' });
    expect(mockedUploadOrganizationAvatar).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith('Organization created');
    });
  });

  it('uploads the avatar after the org is created, using the returned id and selected file', async () => {
    const user = userEvent.setup();
    const file = makeImage('logo.png');
    mockedCreateOrganization.mockResolvedValueOnce({
      id: 'org-42',
      name: 'Acme',
    } as never);
    mockedUploadOrganizationAvatar.mockResolvedValueOnce({} as never);

    renderPage();
    await user.upload(getHiddenFileInput(), file);
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Acme');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(mockedUploadOrganizationAvatar).toHaveBeenCalledTimes(1);
    });
    expect(mockedUploadOrganizationAvatar.mock.calls[0]).toEqual(['org-42', file]);
    // Avatar upload happens after org create — order matters for the new-id contract.
    const createOrder = mockedCreateOrganization.mock.invocationCallOrder[0];
    const uploadOrder = mockedUploadOrganizationAvatar.mock.invocationCallOrder[0];
    expect(uploadOrder).toBeGreaterThan(createOrder);
  });

  it('still creates the org and surfaces a discrete error toast when the avatar upload fails', async () => {
    const user = userEvent.setup();
    mockedCreateOrganization.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Acme',
    } as never);
    mockedUploadOrganizationAvatar.mockRejectedValueOnce(new Error('S3 down'));

    renderPage();
    await user.upload(getHiddenFileInput(), makeImage());
    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Acme');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/avatar upload failed/i),
      );
    });
    // The "Organization created" success toast still fires — the user lands on the detail page.
    expect(mockedToast.success).toHaveBeenCalledWith('Organization created');
    expect(await screen.findByText('ORG DETAIL')).toBeInTheDocument();
  });
});
