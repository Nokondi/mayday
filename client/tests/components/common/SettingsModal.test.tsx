import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/api/auth.js', () => ({
  getMe: vi.fn(),
}));

vi.mock('../../../src/api/users.js', () => ({
  updateUserSettings: vi.fn(),
}));

vi.mock('../../../src/api/communities.js', () => ({
  listMyCommunities: vi.fn(),
  updateCommunityNotifications: vi.fn(),
}));

// The push toggle and devices section drive their own APIs (service worker,
// device list); stub them so this test stays focused on the modal's settings.
vi.mock('../../../src/components/common/PushNotificationsToggle.js', () => ({
  PushNotificationsToggle: () => <div data-testid="push-toggle" />,
}));

vi.mock('../../../src/components/common/DevicesSection.js', () => ({
  DevicesSection: () => <div data-testid="devices-section" />,
}));

import { getMe } from '../../../src/api/auth.js';
import { updateUserSettings } from '../../../src/api/users.js';
import {
  listMyCommunities,
  updateCommunityNotifications,
} from '../../../src/api/communities.js';
import { SettingsModal } from '../../../src/components/common/SettingsModal.js';

const mockedGetMe = vi.mocked(getMe);
const mockedUpdateSettings = vi.mocked(updateUserSettings);
const mockedListMine = vi.mocked(listMyCommunities);
const mockedUpdateCommunityNotifications = vi.mocked(updateCommunityNotifications);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
}

function me(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    pushNotificationsEnabled: true,
    mutedEmailCategories: [],
    mutedPushCategories: [],
    notifyFriendPosts: true,
    notifyCommunityPosts: true,
    minPostNotificationUrgency: 'LOW',
    postNotificationFrequency: 'IMMEDIATE',
    ...overrides,
  };
}

function myCommunities() {
  return [
    { id: 'c1', name: 'Coders', notifyNewPosts: true },
    { id: 'c2', name: 'Gardeners', notifyNewPosts: false },
  ] as never;
}

function renderModal() {
  return render(<SettingsModal open onClose={vi.fn()} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom's <dialog> lacks showModal/close — stub the pieces the modal uses.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  });

  mockedGetMe.mockResolvedValue(me() as never);
  mockedListMine.mockResolvedValue(myCommunities());
  mockedUpdateSettings.mockImplementation(async (data) => ({
    ...(me() as object),
    ...data,
  }) as never);
  mockedUpdateCommunityNotifications.mockResolvedValue({
    communityId: 'c1',
    notifyNewPosts: false,
  });
});

describe('SettingsModal — notification category matrix', () => {
  it('renders a row per category with email and push checkboxes reflecting the muted lists', async () => {
    mockedGetMe.mockResolvedValue(
      me({ mutedEmailCategories: ['MESSAGES'], mutedPushCategories: ['INVITES'] }) as never,
    );
    renderModal();

    expect(await screen.findByRole('checkbox', { name: /email notifications for messages/i }))
      .not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /push notifications for messages/i }))
      .toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /push notifications for community & organization invites/i }),
    ).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /email notifications for new posts/i }))
      .toBeChecked();
    expect(screen.getByRole('checkbox', { name: /email notifications for friend requests/i }))
      .toBeChecked();
    expect(screen.getByRole('checkbox', { name: /email notifications for announcements/i }))
      .toBeChecked();
  });

  it('unchecking an email checkbox saves the category into mutedEmailCategories', async () => {
    const user = userEvent.setup();
    renderModal();

    const commentsEmail = await screen.findByRole('checkbox', {
      name: /email notifications for comments on posts/i,
    });
    await user.click(commentsEmail);

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        mutedEmailCategories: ['COMMENTS'],
      }),
    );
  });

  it('re-checking a push checkbox removes the category from mutedPushCategories', async () => {
    mockedGetMe.mockResolvedValue(
      me({ mutedPushCategories: ['JOIN_REQUESTS', 'MESSAGES'] }) as never,
    );
    const user = userEvent.setup();
    renderModal();

    const joinRequestsPush = await screen.findByRole('checkbox', {
      name: /push notifications for join requests/i,
    });
    expect(joinRequestsPush).not.toBeChecked();
    await user.click(joinRequestsPush);

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        mutedPushCategories: ['MESSAGES'],
      }),
    );
  });

  it('reverts the checkbox when the save fails', async () => {
    mockedUpdateSettings.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    const messagesEmail = await screen.findByRole('checkbox', {
      name: /email notifications for messages/i,
    });
    await user.click(messagesEmail);

    await waitFor(() => expect(messagesEmail).toBeChecked());
  });
});

describe('SettingsModal — post notifications', () => {
  it('renders the friends toggle, urgency select, and per-community checkboxes from loaded settings', async () => {
    renderModal();

    const friendsToggle = await screen.findByRole('checkbox', { name: /friends' posts/i });
    expect(friendsToggle).toBeChecked();

    expect(screen.getByRole('combobox', { name: /minimum urgency/i })).toHaveValue('LOW');

    expect(screen.getByRole('checkbox', { name: /coders/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /gardeners/i })).not.toBeChecked();
  });

  it('toggling community posts off saves the preference and hides the per-community list', async () => {
    const user = userEvent.setup();
    renderModal();

    const masterToggle = await screen.findByRole('checkbox', { name: /community posts/i });
    expect(masterToggle).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /coders/i })).toBeInTheDocument();

    await user.click(masterToggle);

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({ notifyCommunityPosts: false }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: /coders/i })).not.toBeInTheDocument(),
    );
  });

  it('selecting the weekly summary saves the frequency', async () => {
    const user = userEvent.setup();
    renderModal();

    const immediate = await screen.findByRole('radio', { name: /every new post/i });
    const weekly = screen.getByRole('radio', { name: /weekly summary/i });
    expect(immediate).toBeChecked();
    expect(weekly).not.toBeChecked();

    await user.click(weekly);

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        postNotificationFrequency: 'WEEKLY',
      }),
    );
    expect(weekly).toBeChecked();
  });

  it('reverts the frequency when the save fails', async () => {
    mockedUpdateSettings.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    const weekly = await screen.findByRole('radio', { name: /weekly summary/i });
    await user.click(weekly);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /every new post/i })).toBeChecked(),
    );
    expect(weekly).not.toBeChecked();
  });

  it("toggling friends' posts saves the preference", async () => {
    const user = userEvent.setup();
    renderModal();

    const friendsToggle = await screen.findByRole('checkbox', { name: /friends' posts/i });
    await user.click(friendsToggle);

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({ notifyFriendPosts: false }),
    );
  });

  it('changing the minimum urgency saves the preference', async () => {
    const user = userEvent.setup();
    renderModal();

    const select = await screen.findByRole('combobox', { name: /minimum urgency/i });
    await user.selectOptions(select, 'HIGH');

    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        minPostNotificationUrgency: 'HIGH',
      }),
    );
    expect(select).toHaveValue('HIGH');
  });

  it('unchecking a community saves the per-community opt-out', async () => {
    const user = userEvent.setup();
    renderModal();

    const coders = await screen.findByRole('checkbox', { name: /coders/i });
    await user.click(coders);

    await waitFor(() =>
      expect(mockedUpdateCommunityNotifications).toHaveBeenCalledWith('c1', false),
    );
  });

  it("reverts the friends' posts toggle when the save fails", async () => {
    mockedUpdateSettings.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    const friendsToggle = await screen.findByRole('checkbox', { name: /friends' posts/i });
    await user.click(friendsToggle);

    await waitFor(() => expect(friendsToggle).toBeChecked());
  });

  it('reverts a community checkbox when the save fails', async () => {
    mockedUpdateCommunityNotifications.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    const coders = await screen.findByRole('checkbox', { name: /coders/i });
    await user.click(coders);

    await waitFor(() => expect(coders).toBeChecked());
  });
});
