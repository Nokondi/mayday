import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { AvatarUploader } from '../../../src/components/common/AvatarUploader.js';

const mockedToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

/**
 * The component opens a file picker via a ref-click on a hidden <input
 * type="file">. In jsdom that native file picker does nothing, so tests
 * interact with the hidden input directly via userEvent.upload.
 */
function getHiddenFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected a hidden file input in the document');
  }
  return input;
}

function makeImage(
  name = 'avatar.png',
  type = 'image/png',
  sizeBytes = 1024,
): File {
  // Use a Blob body so File.size reflects the requested byte count.
  const body = new Uint8Array(sizeBytes);
  return new File([body], name, { type });
}

function renderUploader(overrides: Partial<Parameters<typeof AvatarUploader>[0]> = {}) {
  const onUpload = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <AvatarUploader
      currentUrl={null}
      fallback={<span data-testid="fallback">F</span>}
      onUpload={onUpload}
      {...overrides}
    />,
  );
  return { onUpload, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AvatarUploader — rendering', () => {
  it('renders the fallback when no currentUrl is provided', () => {
    renderUploader();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the current avatar image when a URL is provided', () => {
    const { container } = renderUploader({ currentUrl: 'https://example.com/avatar.jpg' });
    // The img has alt="" which gives it role="presentation", so query the DOM directly.
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('renders a clickable avatar button when there is no current avatar', () => {
    renderUploader();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders a clickable avatar button when a current avatar exists', () => {
    renderUploader({ currentUrl: 'https://example.com/avatar.jpg' });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('disables the button when disabled prop is true', () => {
    renderUploader({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('AvatarUploader — file validation', () => {
  it('rejects files with a disallowed mime type and does not call onUpload', async () => {
    const { onUpload } = renderUploader();

    // userEvent.upload filters files against the input's `accept` attribute
    // before firing change, so we drive the change event directly in order
    // to exercise the component's own validation path.
    const badFile = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    const input = getHiddenFileInput();
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.stringMatching(/jpeg.*png.*gif.*webp/i),
    );
  });

  it('rejects files larger than 5MB and does not call onUpload', async () => {
    const user = userEvent.setup();
    const { onUpload } = renderUploader();

    const tooBig = makeImage('huge.png', 'image/png', 5 * 1024 * 1024 + 1);
    await user.upload(getHiddenFileInput(), tooBig);

    expect(onUpload).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.stringMatching(/5MB/i),
    );
  });

  it('accepts each allowed image type', async () => {
    const user = userEvent.setup();
    const { onUpload } = renderUploader();
    const input = getHiddenFileInput();

    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      onUpload.mockClear();
      mockedToast.error.mockClear();
      await user.upload(input, makeImage('a.img', type, 10));
      expect(onUpload).toHaveBeenCalledTimes(1);
      expect(mockedToast.error).not.toHaveBeenCalled();
    }
  });
});

describe('AvatarUploader — upload flow', () => {
  it('calls onUpload with the selected file and shows a success toast', async () => {
    const user = userEvent.setup();
    const { onUpload } = renderUploader();

    const file = makeImage();
    await user.upload(getHiddenFileInput(), file);

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith('Avatar updated');
    });
  });

  it('shows the loading state while upload is in-flight and restores it afterward', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onUpload = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(
      <AvatarUploader currentUrl={null} fallback={<span>F</span>} onUpload={onUpload} />,
    );

    await user.upload(getHiddenFileInput(), makeImage());

    // In-flight: the button is disabled.
    const uploadingBtn = screen.getByRole('button');
    expect(uploadingBtn).toBeDisabled();

    resolve();

    // After completion: the button is enabled again.
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  it('shows the server error message when onUpload rejects with an axios-style error', async () => {
    const user = userEvent.setup();
    const onUpload = vi
      .fn()
      .mockRejectedValue({ response: { data: { message: 'Server exploded' } } });
    render(
      <AvatarUploader currentUrl={null} fallback={<span>F</span>} onUpload={onUpload} />,
    );

    await user.upload(getHiddenFileInput(), makeImage());

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('Server exploded');
    });
    expect(mockedToast.success).not.toHaveBeenCalled();
  });

  it('shows a generic error message when onUpload rejects without a response message', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockRejectedValue(new Error('network'));
    render(
      <AvatarUploader currentUrl={null} fallback={<span>F</span>} onUpload={onUpload} />,
    );

    await user.upload(getHiddenFileInput(), makeImage());

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('Failed to upload avatar');
    });
  });

  it('re-enables the button after a failed upload', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockRejectedValue(new Error('network'));
    render(
      <AvatarUploader currentUrl={null} fallback={<span>F</span>} onUpload={onUpload} />,
    );

    await user.upload(getHiddenFileInput(), makeImage());

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  it('resets the input value after handling a file so re-selecting the same file re-triggers upload', async () => {
    const user = userEvent.setup();
    const { onUpload } = renderUploader();
    const input = getHiddenFileInput();
    const file = makeImage();

    await user.upload(input, file);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    // Input value is cleared so the same file can be picked again.
    expect(input.value).toBe('');

    await user.upload(input, file);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
  });
});

describe('AvatarUploader — shape & size', () => {
  it('defaults to a circular shape', () => {
    renderUploader();
    // The avatar frame is the element containing the fallback.
    const frame = screen.getByTestId('fallback').parentElement as HTMLElement;
    expect(frame).toHaveClass('rounded-full');
  });

  it('uses rounded-lg when shape="square" is passed', () => {
    renderUploader({ shape: 'square' });
    const frame = screen.getByTestId('fallback').parentElement as HTMLElement;
    expect(frame).toHaveClass('rounded-lg');
    expect(frame).not.toHaveClass('rounded-full');
  });

  it('applies the custom size to the avatar frame', () => {
    renderUploader({ size: 120 });
    const frame = screen.getByTestId('fallback').parentElement as HTMLElement;
    expect(frame).toHaveStyle({ width: '120px', height: '120px' });
  });
});
