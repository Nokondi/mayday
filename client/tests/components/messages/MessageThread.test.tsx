import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@mayday/shared';
import { MessageThread } from '../../../src/components/messages/MessageThread.js';

// jsdom does not implement scrollIntoView; the component calls it in an effect.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'hi',
    senderId: 'u2',
    receiverId: 'u1',
    conversationId: 'c1',
    readAt: null,
    createdAt: '2020-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MessageThread', () => {
  it('renders a polite live region labeled "Message history"', () => {
    render(<MessageThread messages={[]} currentUserId="u1" />);
    // A plain <div> with aria-label is not auto-promoted to role="region" in
    // the jsdom a11y tree, so query via the accessible name instead.
    const region = screen.getByLabelText('Message history');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders an empty thread when there are no messages', () => {
    render(<MessageThread messages={[]} currentUserId="u1" />);
    const region = screen.getByLabelText('Message history');
    // No <p> for a message is rendered in the empty state.
    expect(region.querySelectorAll('p').length).toBe(0);
  });

  it('renders each message content', () => {
    const messages = [
      makeMessage({ id: 'm1', content: 'Hello' }),
      makeMessage({ id: 'm2', content: 'World' }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('styles the current user\'s messages as "mine" (right-aligned, mayday color)', () => {
    const messages = [makeMessage({ id: 'm1', content: 'mine', senderId: 'u1' })];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText('mine');
    // The colored bubble is the <p>'s parent.
    const bubble = text.parentElement as HTMLElement;
    expect(bubble).toHaveClass('bg-mayday-500', 'text-white');
    // The row wrapping the bubble is right-justified.
    const row = bubble.parentElement as HTMLElement;
    expect(row).toHaveClass('justify-end');
  });

  it('styles other users\' messages as "theirs" (left-aligned, gray)', () => {
    const messages = [makeMessage({ id: 'm1', content: 'theirs', senderId: 'u2' })];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText('theirs');
    const bubble = text.parentElement as HTMLElement;
    expect(bubble).toHaveClass('bg-gray-100', 'text-gray-900');
    const row = bubble.parentElement as HTMLElement;
    expect(row).toHaveClass('justify-start');
  });

  it('scrolls the bottom anchor into view when messages change', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(
      <MessageThread messages={[makeMessage({ id: 'm1' })]} currentUserId="u1" />,
    );
    // Initial mount triggers the effect.
    expect(spy).toHaveBeenCalled();
    spy.mockClear();

    rerender(
      <MessageThread
        messages={[makeMessage({ id: 'm1' }), makeMessage({ id: 'm2', content: 'new' })]}
        currentUserId="u1"
      />,
    );
    expect(spy).toHaveBeenCalled();
  });

  it('renders a relative-time line for each message', () => {
    const messages = [makeMessage({ id: 'm1', content: 'hi' })];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText('hi');
    const bubble = text.parentElement as HTMLElement;
    const paragraphs = within(bubble).getAllByText((_, el) => el?.tagName === 'P');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toMatch(/ago$/);
  });
});
