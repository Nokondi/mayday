import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FriendStatus } from "@mayday/shared";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/api/friends.js", () => ({
  sendFriendRequest: vi.fn().mockResolvedValue({ status: "PENDING" }),
  acceptFriendRequest: vi.fn().mockResolvedValue(undefined),
  cancelFriendRequest: vi.fn().mockResolvedValue(undefined),
  removeFriend: vi.fn().mockResolvedValue(undefined),
}));

import { FriendButton } from "../../../src/components/users/FriendButton.js";
import { renderWithIntl } from "../../helpers/renderWithIntl.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "../../../src/api/friends.js";

const mockedSend = vi.mocked(sendFriendRequest);
const mockedAccept = vi.mocked(acceptFriendRequest);
const mockedCancel = vi.mocked(cancelFriendRequest);
const mockedRemove = vi.mocked(removeFriend);

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function renderButton(status: FriendStatus, requestId: string | null = null) {
  return render(
    <FriendButton userId="u2" friendStatus={status} friendRequestId={requestId} />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("FriendButton", () => {
  it("sends a request from the NONE state", async () => {
    renderButton("NONE");
    await userEvent.click(screen.getByRole("button", { name: /add friend/i }));
    expect(mockedSend).toHaveBeenCalledWith("u2");
  });

  it("accepts an incoming request from the REQUEST_RECEIVED state", async () => {
    renderButton("REQUEST_RECEIVED", "r1");
    await userEvent.click(screen.getByRole("button", { name: /accept request/i }));
    expect(mockedAccept).toHaveBeenCalledWith("r1");
  });

  it("cancels an outgoing request from the REQUEST_SENT state", async () => {
    renderButton("REQUEST_SENT", "r1");
    await userEvent.click(screen.getByRole("button", { name: /cancel request/i }));
    expect(mockedCancel).toHaveBeenCalledWith("r1");
  });

  it("requires a second click to remove an existing friend", async () => {
    renderButton("FRIENDS");
    const button = screen.getByRole("button", { name: /friends/i });
    await userEvent.click(button);
    // First click only arms the confirm; no removal yet.
    expect(mockedRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /remove friend/i }));
    await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith("u2"));
  });
});
