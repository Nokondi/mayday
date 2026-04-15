import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conversation, Message, UserPublicProfile } from '@mayday/shared';
import { ConversationList } from '../../../src/components/messages/ConversationList.js';

function makeParticipant(overrides: Partial<UserPublicProfile> = {}): UserPublicProfile {
  return {
    id: 'u2',
    name: 'Bob',
    bio: null,
    location: null,
    skills: [],
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'hello',
    senderId: 'u2',
    receiverId: 'u1',
    conversationId: 'c1',
    readAt: null,
    // A long time ago so formatDistanceToNow output is stable across runs.
    createdAt: '2020-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    participantAId: 'u1',
    participantBId: 'u2',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    otherParticipant: makeParticipant(),
    lastMessage: null,
    unreadCount: 0,
    ...overrides,
  };
}

describe('ConversationList — empty state', () => {
  it('shows an empty-state message when there are no conversations', () => {
    render(<ConversationList conversations={[]} onSelect={() => {}} />);
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });

  it('does not render any conversation buttons when empty', () => {
    render(<ConversationList conversations={[]} onSelect={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ConversationList — rendering', () => {
  it('renders one button per conversation', () => {
    const conversations = [
      makeConversation({ id: 'c1', otherParticipant: makeParticipant({ name: 'Alice' }) }),
      makeConversation({ id: 'c2', otherParticipant: makeParticipant({ name: 'Bob' }) }),
    ];
    render(<ConversationList conversations={conversations} onSelect={() => {}} />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('uses an aria-label mentioning the other participant name', () => {
    const conversations = [
      makeConversation({ otherParticipant: makeParticipant({ name: 'Alice' }) }),
    ];
    render(<ConversationList conversations={conversations} onSelect={() => {}} />);

    expect(
      screen.getByRole('button', { name: /conversation with alice$/i }),
    ).toBeInTheDocument();
  });

  it('renders the unread count badge and includes it in the aria-label when > 0', () => {
    const conversations = [
      makeConversation({
        id: 'c1',
        otherParticipant: makeParticipant({ name: 'Alice' }),
        unreadCount: 3,
      }),
    ];
    render(<ConversationList conversations={conversations} onSelect={() => {}} />);

    const button = screen.getByRole('button', {
      name: /conversation with alice, 3 unread/i,
    });
    expect(button).toHaveTextContent('3');
  });

  it('does not render a badge when unreadCount is 0', () => {
    const conversations = [
      makeConversation({
        otherParticipant: makeParticipant({ name: 'Alice' }),
        unreadCount: 0,
      }),
    ];
    render(<ConversationList conversations={conversations} onSelect={() => {}} />);

    const button = screen.getByRole('button');
    // No numeric digits should appear in the button when unreadCount is 0.
    expect(button.textContent).not.toMatch(/\d/);
  });

  it('renders the last message preview when present', () => {
    const conversations = [
      makeConversation({
        lastMessage: makeMessage({ content: 'See you at 5' }),
      }),
    ];
    render(<ConversationList conversations={conversations} onSelect={() => {}} />);
    expect(screen.getByText('See you at 5')).toBeInTheDocument();
  });

  it('does not render the last-message or timestamp lines when lastMessage is null', () => {
    const conversations = [makeConversation({ lastMessage: null })];
    const { container } = render(
      <ConversationList conversations={conversations} onSelect={() => {}} />,
    );
    // The button only contains the header div (name + no badge) when there
    // is no last message.
    const paragraphs = container.querySelectorAll('button p');
    expect(paragraphs.length).toBe(0);
  });
});

describe('ConversationList — active & interaction', () => {
  it('marks the active conversation with aria-current', () => {
    const conversations = [
      makeConversation({ id: 'c1' }),
      makeConversation({ id: 'c2' }),
    ];
    render(
      <ConversationList conversations={conversations} activeId="c2" onSelect={() => {}} />,
    );

    const [first, second] = screen.getAllByRole('button');
    expect(first).not.toHaveAttribute('aria-current');
    expect(second).toHaveAttribute('aria-current', 'true');
  });

  it('calls onSelect with the clicked conversation id', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const conversations = [
      makeConversation({ id: 'conv-123', otherParticipant: makeParticipant({ name: 'Alice' }) }),
    ];
    render(<ConversationList conversations={conversations} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /conversation with alice/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('conv-123');
  });
});
