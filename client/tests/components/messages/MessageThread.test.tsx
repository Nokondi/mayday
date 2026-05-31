import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { RenderableMessage } from "../../../src/crypto/render.js";
import { MessageThread } from "../../../src/components/messages/MessageThread.js";
import { renderWithIntl as render } from "../../helpers/renderWithIntl.js";

function makeMessage(overrides: Partial<RenderableMessage> = {}): RenderableMessage {
  return {
    id: "m1",
    type: "TEXT",
    metadata: null,
    content: "hi",
    senderId: "u2",
    receiverId: "u1",
    conversationId: "c1",
    readAt: null,
    createdAt: "2020-01-01T00:00:00Z",
    encryptionStatus: "encrypted",
    ...overrides,
  };
}

describe("MessageThread", () => {
  it('renders a polite live region labeled "Message history"', () => {
    render(<MessageThread messages={[]} currentUserId="u1" />);
    // A plain <div> with aria-label is not auto-promoted to role="region" in
    // the jsdom a11y tree, so query via the accessible name instead.
    const region = screen.getByLabelText("Message history");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders an empty thread when there are no messages", () => {
    render(<MessageThread messages={[]} currentUserId="u1" />);
    const region = screen.getByLabelText("Message history");
    // No <p> for a message is rendered in the empty state.
    expect(region.querySelectorAll("p").length).toBe(0);
  });

  it("renders each message content", () => {
    const messages = [
      makeMessage({ id: "m1", content: "Hello" }),
      makeMessage({ id: "m2", content: "World" }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("World")).toBeInTheDocument();
  });

  it('styles the current user\'s messages as "mine" (right-aligned, mayday color)', () => {
    const messages = [
      makeMessage({ id: "m1", content: "mine", senderId: "u1" }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText("mine");
    // The colored bubble is the <p>'s parent.
    const bubble = text.parentElement as HTMLElement;
    expect(bubble).toHaveClass("bg-mayday-700", "text-white");
    // The row wrapping the bubble is right-justified.
    const row = bubble.parentElement as HTMLElement;
    expect(row).toHaveClass("justify-end");
  });

  it('styles other users\' messages as "theirs" (left-aligned, white with border)', () => {
    const messages = [
      makeMessage({ id: "m1", content: "theirs", senderId: "u2" }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText("theirs");
    const bubble = text.parentElement as HTMLElement;
    expect(bubble).toHaveClass(
      "bg-white",
      "text-gray-900",
      "border",
      "border-mayday-300",
    );
    const row = bubble.parentElement as HTMLElement;
    expect(row).toHaveClass("justify-start");
  });

  it("scrolls its own container to the bottom when messages change", () => {
    // The component sets scrollTop = scrollHeight on the container directly
    // rather than calling scrollIntoView, because scrollIntoView propagates
    // through every ancestor scroll container — including the window — and
    // would push the mobile drawer header off the page.
    render(
      <MessageThread
        messages={[makeMessage({ id: "m1" })]}
        currentUserId="u1"
      />,
    );
    const container = screen.getByLabelText("Message history") as HTMLElement;
    // jsdom reports scrollHeight as 0 (no layout), but the effect still copies
    // it to scrollTop. Stub scrollHeight to a non-zero value to verify the
    // assignment actually happens.
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      value: 999,
    });
    container.scrollTop = 0;
    // Re-render with a new messages array to retrigger the effect.
    render(
      <MessageThread
        messages={[
          makeMessage({ id: "m1" }),
          makeMessage({ id: "m2", content: "new" }),
        ]}
        currentUserId="u1"
      />,
    );
    const containers = screen.getAllByLabelText("Message history") as HTMLElement[];
    const latest = containers[containers.length - 1];
    expect(latest.scrollTop).toBe(latest.scrollHeight);
  });

  it("renders a relative-time line for each message", () => {
    const messages = [makeMessage({ id: "m1", content: "hi" })];
    render(<MessageThread messages={messages} currentUserId="u1" />);

    const text = screen.getByText("hi");
    const bubble = text.parentElement as HTMLElement;
    const paragraphs = within(bubble).getAllByText(
      (_, el) => el?.tagName === "P",
    );
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toMatch(/ago$/);
  });

  it('shows the "Not end-to-end encrypted" badge on legacy plaintext messages', () => {
    const messages = [
      makeMessage({ id: "m1", content: "old plain", encryptionStatus: "legacy" }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);
    // The badge is offered to assistive tech via aria-label/sr-only — querying
    // by accessible name ensures we don't lose this if the icon changes.
    expect(screen.getAllByLabelText("Not end-to-end encrypted").length).toBeGreaterThan(0);
  });

  it('does NOT show the legacy badge on encrypted messages', () => {
    const messages = [
      makeMessage({ id: "m1", content: "secret", encryptionStatus: "encrypted" }),
    ];
    render(<MessageThread messages={messages} currentUserId="u1" />);
    expect(screen.queryByLabelText("Not end-to-end encrypted")).toBeNull();
  });

  const inviteMessage = (status: "PENDING" | "ACCEPTED" = "PENDING") =>
    makeMessage({
      id: "inv-msg",
      type: "INVITE",
      content: "",
      senderId: "u2",
      receiverId: "u1",
      metadata: {
        inviteKind: "ORGANIZATION",
        inviteId: "inv1",
        targetId: "org1",
        targetName: "Acme Co",
        status,
      },
    });

  it("renders an invite card with Accept/Decline for the recipient", async () => {
    const onAcceptInvite = vi.fn();
    const onDeclineInvite = vi.fn();
    render(
      <MemoryRouter>
        <MessageThread
          messages={[inviteMessage()]}
          currentUserId="u1"
          onAcceptInvite={onAcceptInvite}
          onDeclineInvite={onDeclineInvite}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acme Co")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAcceptInvite).toHaveBeenCalledWith(
      expect.objectContaining({ inviteId: "inv1", inviteKind: "ORGANIZATION" }),
    );
  });

  it("hides Accept/Decline for the sender's own invite card", () => {
    // currentUserId is the sender (u2) here, so no action buttons.
    render(
      <MemoryRouter>
        <MessageThread messages={[inviteMessage()]} currentUserId="u2" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("shows a resolved status instead of buttons once the invite is accepted", () => {
    render(
      <MemoryRouter>
        <MessageThread
          messages={[inviteMessage("ACCEPTED")]}
          currentUserId="u1"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});
