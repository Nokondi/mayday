import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import type { InviteMessageMetadata } from "@mayday/shared";
import { InviteMessageCard } from "../../../src/components/messages/InviteMessageCard.js";
import { renderWithIntl } from "../../helpers/renderWithIntl.js";

function makeMetadata(
  overrides: Partial<InviteMessageMetadata> = {},
): InviteMessageMetadata {
  return {
    inviteKind: "ORGANIZATION",
    inviteId: "inv1",
    targetId: "org1",
    targetName: "Acme Co",
    status: "PENDING",
    ...overrides,
  };
}

function render(ui: React.ReactElement) {
  return renderWithIntl(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("InviteMessageCard", () => {
  it("links an organization invite to the organization page", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata()}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Acme Co" })).toHaveAttribute(
      "href",
      "/organizations/org1",
    );
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("links a community invite to the community page", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata({ inviteKind: "COMMUNITY", targetId: "c1", targetName: "Helpers" })}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Helpers" })).toHaveAttribute(
      "href",
      "/communities/c1",
    );
    expect(screen.getByText("Community")).toBeInTheDocument();
  });

  it("links a friend request to the requester's profile and prompts the recipient", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata({ inviteKind: "FRIEND", targetId: "u1", targetName: "Dana" })}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Dana" })).toHaveAttribute(
      "href",
      "/profile/u1",
    );
    expect(screen.getByText("Friend request")).toBeInTheDocument();
    expect(screen.getByText("Dana wants to be your friend.")).toBeInTheDocument();
  });

  it("shows a 'Friends' state for an accepted friend request", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata({ inviteKind: "FRIEND", status: "ACCEPTED", targetName: "Dana" })}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing={false}
      />,
    );
    expect(screen.getByText("Friends")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("fires onDecline when the recipient declines", async () => {
    const onDecline = vi.fn();
    render(
      <InviteMessageCard
        metadata={makeMetadata()}
        isRecipient
        onAccept={() => {}}
        onDecline={onDecline}
        isActing={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("disables the action buttons while an action is in flight", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata()}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing
      />,
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  });

  it("shows a withdrawn state with no buttons for a revoked invite", () => {
    render(
      <InviteMessageCard
        metadata={makeMetadata({ status: "REVOKED" })}
        isRecipient
        onAccept={() => {}}
        onDecline={() => {}}
        isActing={false}
      />,
    );
    expect(screen.getByText("Invitation withdrawn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});
