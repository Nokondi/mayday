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
// The stub exposes a button that reports "effectively off" upward, mirroring
// the real toggle's onEffectiveEnabledChange contract.
vi.mock('../../../src/components/common/PushNotificationsToggle.js', () => ({
  PushNotificationsToggle: (props: {
    onEffectiveEnabledChange?: (enabled: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="push-toggle"
      onClick={() => props.onEffectiveEnabledChange?.(false)}
    >
      push-toggle-stub
    </button>
  ),
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
    expect(screen.getByRole('checkbox', { name: /email notifications for friend requests/i }))
      .toBeChecked();
    expect(screen.getByRole('checkbox', { name: /email notifications for announcements/i }))
      .toBeChecked();
    // The post audiences are rows in the main list now, ordered last.
    expect(screen.getByRole('checkbox', { name: /email notifications for friends' posts/i }))
      .toBeChecked();
    expect(screen.getByRole('checkbox', { name: /push notifications for community posts/i }))
      .toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /new posts/i })).not.toBeInTheDocument();
  });

  it('orders the post audiences as the last rows of the matrix', async () => {
    renderModal();
    await screen.findByRole('checkbox', { name: /email notifications for messages/i });

    const rowHeaders = screen
      .getAllByRole('rowheader')
      .map((th) => th.textContent);
    expect(rowHeaders.slice(-2)).toEqual(["Friends' posts", 'Community posts']);
  });

  it('disables the push column (email untouched) when the stored push pref is off', async () => {
    mockedGetMe.mockResolvedValue(me({ pushNotificationsEnabled: false }) as never);
    renderModal();

    const messagesPush = await screen.findByRole('checkbox', {
      name: /push notifications for messages/i,
    });
    expect(messagesPush).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /push notifications for announcements/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /email notifications for messages/i }),
    ).toBeEnabled();
  });

  it('disables the push column live when the push toggle reports effectively off', async () => {
    const user = userEvent.setup();
    renderModal();

    const messagesPush = await screen.findByRole('checkbox', {
      name: /push notifications for messages/i,
    });
    expect(messagesPush).toBeEnabled();

    await user.click(screen.getByTestId('push-toggle'));

    expect(messagesPush).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /email notifications for messages/i }),
    ).toBeEnabled();
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
  it('renders the urgency select and per-community checkboxes from loaded settings', async () => {
    renderModal();

    expect(await screen.findByRole('combobox', { name: /minimum urgency/i })).toHaveValue('LOW');

    expect(screen.getByRole('checkbox', { name: /coders/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /gardeners/i })).not.toBeChecked();
  });

  it('hides the per-community list when community posts are muted on both channels', async () => {
    mockedGetMe.mockResolvedValue(
      me({
        mutedEmailCategories: ['COMMUNITY_POSTS'],
        mutedPushCategories: ['COMMUNITY_POSTS'],
      }) as never,
    );
    renderModal();

    await screen.findByRole('combobox', { name: /minimum urgency/i });
    expect(screen.queryByRole('checkbox', { name: /coders/i })).not.toBeInTheDocument();
  });

  it('keeps the per-community list while community posts are reachable on one channel', async () => {
    mockedGetMe.mockResolvedValue(
      me({ mutedEmailCategories: ['COMMUNITY_POSTS'] }) as never,
    );
    renderModal();

    expect(await screen.findByRole('checkbox', { name: /coders/i })).toBeInTheDocument();
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

  it('reverts a community checkbox when the save fails', async () => {
    mockedUpdateCommunityNotifications.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    const coders = await screen.findByRole('checkbox', { name: /coders/i });
    await user.click(coders);

    await waitFor(() => expect(coders).toBeChecked());
  });
});
