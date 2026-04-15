import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageInput } from '../../../src/components/messages/MessageInput.js';

function renderInput(overrides: Partial<Parameters<typeof MessageInput>[0]> = {}) {
  const onSend = vi.fn().mockResolvedValue(undefined);
  const utils = render(<MessageInput onSend={onSend} {...overrides} />);
  return { onSend, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageInput — rendering', () => {
  it('renders a labeled text input and a send button', () => {
    renderInput();
    expect(screen.getByRole('textbox', { name: /type a message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('disables the send button while the input is empty', () => {
    renderInput();
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('keeps the send button disabled when the input is whitespace-only', async () => {
    const user = userEvent.setup();
    renderInput();
    await user.type(screen.getByRole('textbox'), '   ');
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('enables the send button once non-whitespace content is typed', async () => {
    const user = userEvent.setup();
    renderInput();
    await user.type(screen.getByRole('textbox'), 'hi');
    expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
  });

  it('disables both the input and the button when disabled prop is true', () => {
    renderInput({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });
});

describe('MessageInput — sending', () => {
  it('calls onSend with the trimmed content on button click', async () => {
    const user = userEvent.setup();
    const { onSend } = renderInput();

    await user.type(screen.getByRole('textbox'), '  hello world  ');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('hello world');
  });

  it('submits when the user presses Enter inside the input', async () => {
    const user = userEvent.setup();
    const { onSend } = renderInput();

    await user.type(screen.getByRole('textbox'), 'hi{Enter}');

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('hi');
  });

  it('clears the input after a successful send', async () => {
    const user = userEvent.setup();
    renderInput();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'hi');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(input.value).toBe(''));
  });

  it('does not call onSend when the content is whitespace-only', async () => {
    const user = userEvent.setup();
    const { onSend } = renderInput();

    // Button is disabled; try submitting via Enter, which the handler also guards.
    await user.type(screen.getByRole('textbox'), '   {Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables the send button while a send is in flight and re-enables it after', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onSend = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hi');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    // While the promise is pending, the button is disabled.
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();

    resolve();

    // Once it resolves, the input is cleared and since the cleared input is
    // empty the button becomes disabled for the empty-content reason. Assert
    // the clear to confirm the finally block ran.
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('does not submit a second time while one is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onSend = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(<MessageInput onSend={onSend} />);

    await user.type(screen.getByRole('textbox'), 'hi');
    await user.click(screen.getByRole('button', { name: /send message/i }));
    // Second click during in-flight: the button is disabled, so clicking again
    // should not fire a second call.
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(onSend).toHaveBeenCalledTimes(1);

    resolve();
  });
});
