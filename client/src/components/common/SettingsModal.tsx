import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import type { CommunityWithMembership, NotificationCategory, UrgencyLevel } from '@mayday/shared';
import { NOTIFICATION_CATEGORIES } from '@mayday/shared';
import { updateUserSettings } from '../../api/users.js';
import { listMyCommunities, updateCommunityNotifications } from '../../api/communities.js';
import * as authApi from '../../api/auth.js';
import { useToastMutation } from '../../hooks/useToastMutation.js';
import { PushNotificationsToggle } from './PushNotificationsToggle.js';
import { DevicesSection } from './DevicesSection.js';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const URGENCY_LEVELS: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type PostNotificationFrequency = 'IMMEDIATE' | 'WEEKLY';

const categoryMessages = defineMessages({
  INVITES: {
    id: 'common.settingsModal.category.invites',
    defaultMessage: 'Community & organization invites',
  },
  JOIN_REQUESTS: {
    id: 'common.settingsModal.category.joinRequests',
    defaultMessage: 'Join requests',
  },
  MESSAGES: {
    id: 'common.settingsModal.category.messages',
    defaultMessage: 'Messages',
  },
  COMMENTS: {
    id: 'common.settingsModal.category.comments',
    defaultMessage: 'Comments on posts',
  },
  NEW_POSTS: {
    id: 'common.settingsModal.category.newPosts',
    defaultMessage: 'New posts',
  },
  FRIEND_REQUESTS: {
    id: 'common.settingsModal.category.friendRequests',
    defaultMessage: 'Friend requests',
  },
  ANNOUNCEMENTS: {
    id: 'common.settingsModal.category.announcements',
    defaultMessage: 'Announcements',
  },
});

const urgencyOptionMessages = defineMessages({
  LOW: {
    id: 'common.settingsModal.urgencyOption.low',
    defaultMessage: 'Low (all posts)',
  },
  MEDIUM: {
    id: 'common.settingsModal.urgencyOption.medium',
    defaultMessage: 'Medium and above',
  },
  HIGH: {
    id: 'common.settingsModal.urgencyOption.high',
    defaultMessage: 'High and above',
  },
  CRITICAL: {
    id: 'common.settingsModal.urgencyOption.critical',
    defaultMessage: 'Critical only',
  },
});

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState<boolean | null>(null);
  const [mutedEmail, setMutedEmail] = useState<NotificationCategory[] | null>(null);
  const [mutedPush, setMutedPush] = useState<NotificationCategory[] | null>(null);
  const [notifyFriendPosts, setNotifyFriendPosts] = useState<boolean | null>(null);
  const [notifyCommunityPosts, setNotifyCommunityPosts] = useState<boolean | null>(null);
  const [minUrgency, setMinUrgency] = useState<UrgencyLevel | null>(null);
  const [frequency, setFrequency] = useState<PostNotificationFrequency | null>(null);
  const [communities, setCommunities] = useState<CommunityWithMembership[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([authApi.getMe(), listMyCommunities()])
      .then(([me, mine]) => {
        if (cancelled) return;
        setPushNotificationsEnabled(Boolean(me.pushNotificationsEnabled));
        setMutedEmail((me.mutedEmailCategories as NotificationCategory[]) ?? []);
        setMutedPush((me.mutedPushCategories as NotificationCategory[]) ?? []);
        setNotifyFriendPosts(Boolean(me.notifyFriendPosts));
        setNotifyCommunityPosts(Boolean(me.notifyCommunityPosts));
        setMinUrgency((me.minPostNotificationUrgency as UrgencyLevel) ?? 'LOW');
        setFrequency((me.postNotificationFrequency as PostNotificationFrequency) ?? 'IMMEDIATE');
        setCommunities(mine);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(
          intl.formatMessage({
            id: 'common.settingsModal.loadFailedToast',
            defaultMessage: 'Failed to load settings',
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, intl]);

  const savedToast = intl.formatMessage({
    id: 'common.settingsModal.savedToast',
    defaultMessage: 'Settings saved',
  });
  const updateFailedToast = intl.formatMessage({
    id: 'common.settingsModal.updateFailedToast',
    defaultMessage: 'Failed to update settings',
  });

  type MutedField = 'mutedEmailCategories' | 'mutedPushCategories';

  const mutedMutation = useToastMutation({
    mutationFn: (vars: {
      field: MutedField;
      next: NotificationCategory[];
      prev: NotificationCategory[];
    }) => updateUserSettings({ [vars.field]: vars.next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, vars) => {
      // Revert optimistic update
      if (vars.field === 'mutedEmailCategories') setMutedEmail(vars.prev);
      else setMutedPush(vars.prev);
    },
    onSuccess: (data, vars) => {
      if (vars.field === 'mutedEmailCategories') setMutedEmail(data.mutedEmailCategories);
      else setMutedPush(data.mutedPushCategories);
    },
  });

  const handleCategoryToggle = (
    field: MutedField,
    category: NotificationCategory,
    enabled: boolean,
  ) => {
    const prev = (field === 'mutedEmailCategories' ? mutedEmail : mutedPush) ?? [];
    // enabled = checkbox on = category NOT muted.
    const next = enabled
      ? prev.filter((c) => c !== category)
      : [...new Set([...prev, category])];
    if (field === 'mutedEmailCategories') setMutedEmail(next);
    else setMutedPush(next);
    mutedMutation.mutate({ field, next, prev });
  };

  const friendPostsMutation = useToastMutation({
    mutationFn: (next: boolean) => updateUserSettings({ notifyFriendPosts: next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, attemptedValue) => {
      setNotifyFriendPosts(!attemptedValue);
    },
    onSuccess: (data) => {
      setNotifyFriendPosts(data.notifyFriendPosts);
    },
  });

  const handleFriendPostsToggle = (next: boolean) => {
    setNotifyFriendPosts(next);
    friendPostsMutation.mutate(next);
  };

  const communityPostsMutation = useToastMutation({
    mutationFn: (next: boolean) => updateUserSettings({ notifyCommunityPosts: next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, attemptedValue) => {
      setNotifyCommunityPosts(!attemptedValue);
    },
    onSuccess: (data) => {
      setNotifyCommunityPosts(data.notifyCommunityPosts);
    },
  });

  const handleCommunityPostsToggle = (next: boolean) => {
    setNotifyCommunityPosts(next);
    communityPostsMutation.mutate(next);
  };

  const frequencyMutation = useToastMutation({
    mutationFn: (vars: { next: PostNotificationFrequency; prev: PostNotificationFrequency }) =>
      updateUserSettings({ postNotificationFrequency: vars.next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, vars) => {
      setFrequency(vars.prev);
    },
    onSuccess: (data) => {
      setFrequency(data.postNotificationFrequency);
    },
  });

  const handleFrequencyChange = (next: PostNotificationFrequency) => {
    const prev = frequency ?? 'IMMEDIATE';
    if (next === prev) return;
    setFrequency(next);
    frequencyMutation.mutate({ next, prev });
  };

  const urgencyMutation = useToastMutation({
    mutationFn: (vars: { next: UrgencyLevel; prev: UrgencyLevel }) =>
      updateUserSettings({ minPostNotificationUrgency: vars.next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, vars) => {
      setMinUrgency(vars.prev);
    },
    onSuccess: (data) => {
      setMinUrgency(data.minPostNotificationUrgency);
    },
  });

  const handleUrgencyChange = (next: UrgencyLevel) => {
    const prev = minUrgency ?? 'LOW';
    setMinUrgency(next);
    urgencyMutation.mutate({ next, prev });
  };

  const communityMutation = useToastMutation({
    mutationFn: (vars: { id: string; next: boolean }) =>
      updateCommunityNotifications(vars.id, vars.next),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, vars) => {
      setCommunities((prev) =>
        prev?.map((c) => (c.id === vars.id ? { ...c, notifyNewPosts: !vars.next } : c)) ?? prev,
      );
    },
  });

  const handleCommunityToggle = (id: string, next: boolean) => {
    setCommunities((prev) =>
      prev?.map((c) => (c.id === id ? { ...c, notifyNewPosts: next } : c)) ?? prev,
    );
    communityMutation.mutate({ id, next });
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss; Escape is handled natively by <dialog>
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-modal-title"
      className="backdrop:bg-black/50 bg-transparent p-0 m-auto max-w-md w-full"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="settings-modal-title" className="text-lg font-bold text-gray-900">
            <FormattedMessage
              id="common.settingsModal.title"
              defaultMessage="Settings"
            />
          </h2>
          <button
            onClick={onClose}
            aria-label={intl.formatMessage({
              id: 'common.settingsModal.closeAriaLabel',
              defaultMessage: 'Close settings',
            })}
            className="text-gray-500 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading
          || pushNotificationsEnabled === null
          || mutedEmail === null
          || mutedPush === null
          || notifyFriendPosts === null
          || notifyCommunityPosts === null
          || minUrgency === null
          || frequency === null
          || communities === null ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                <FormattedMessage
                  id="common.settingsModal.notificationsHeading"
                  defaultMessage="Notifications"
                />
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                <FormattedMessage
                  id="common.settingsModal.notificationsDescription"
                  defaultMessage="Choose how to be notified about each kind of activity. Push also requires push notifications to be enabled on this device below."
                />
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <td />
                    <th scope="col" className="font-medium pb-1 w-14 text-center">
                      <FormattedMessage
                        id="common.settingsModal.emailColumnHeader"
                        defaultMessage="Email"
                      />
                    </th>
                    <th scope="col" className="font-medium pb-1 w-14 text-center">
                      <FormattedMessage
                        id="common.settingsModal.pushColumnHeader"
                        defaultMessage="Push"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_CATEGORIES.map((category) => {
                    const label = intl.formatMessage(categoryMessages[category]);
                    return (
                      <tr key={category}>
                        <th scope="row" className="font-normal text-left text-gray-900 py-1">
                          {label}
                        </th>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={!mutedEmail.includes(category)}
                            onChange={(e) =>
                              handleCategoryToggle('mutedEmailCategories', category, e.target.checked)
                            }
                            disabled={mutedMutation.isPending}
                            aria-label={intl.formatMessage(
                              {
                                id: 'common.settingsModal.emailCategoryAriaLabel',
                                defaultMessage: 'Email notifications for {category}',
                              },
                              { category: label },
                            )}
                            className="w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={!mutedPush.includes(category)}
                            onChange={(e) =>
                              handleCategoryToggle('mutedPushCategories', category, e.target.checked)
                            }
                            disabled={mutedMutation.isPending}
                            aria-label={intl.formatMessage(
                              {
                                id: 'common.settingsModal.pushCategoryAriaLabel',
                                defaultMessage: 'Push notifications for {category}',
                              },
                              { category: label },
                            )}
                            className="w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PushNotificationsToggle initialEnabled={pushNotificationsEnabled} />

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                <FormattedMessage
                  id="common.settingsModal.postNotificationsHeading"
                  defaultMessage="Post notifications"
                />
              </h3>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyFriendPosts}
                  onChange={(e) => handleFriendPostsToggle(e.target.checked)}
                  disabled={friendPostsMutation.isPending}
                  className="mt-1 w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    <FormattedMessage
                      id="common.settingsModal.friendPostsToggleLabel"
                      defaultMessage="Friends' posts"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <FormattedMessage
                      id="common.settingsModal.friendPostsToggleDescription"
                      defaultMessage="Notify me when a friend shares a new post."
                    />
                  </div>
                </div>
                {friendPostsMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
                )}
              </label>

              <label className="flex items-start gap-3 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={notifyCommunityPosts}
                  onChange={(e) => handleCommunityPostsToggle(e.target.checked)}
                  disabled={communityPostsMutation.isPending}
                  className="mt-1 w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    <FormattedMessage
                      id="common.settingsModal.communityPostsToggleLabel"
                      defaultMessage="Community posts"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <FormattedMessage
                      id="common.settingsModal.communityPostsToggleDescription"
                      defaultMessage="Notify me when a post is shared in my communities."
                    />
                  </div>
                </div>
                {communityPostsMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
                )}
              </label>

              {notifyCommunityPosts && communities.length > 0 && (
                <fieldset className="mt-3 ml-7">
                  <legend className="sr-only">
                    <FormattedMessage
                      id="common.settingsModal.communityPostsLegend"
                      defaultMessage="Communities"
                    />
                  </legend>
                  <p className="text-xs text-gray-500">
                    <FormattedMessage
                      id="common.settingsModal.communityPostsDescription"
                      defaultMessage="Choose which of your communities notify you about new posts."
                    />
                  </p>
                  <div className="mt-2 space-y-2">
                    {communities.map((community) => {
                      const pending =
                        communityMutation.isPending
                        && communityMutation.variables?.id === community.id;
                      return (
                        <label key={community.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={community.notifyNewPosts !== false}
                            onChange={(e) => handleCommunityToggle(community.id, e.target.checked)}
                            disabled={pending}
                            className="w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                          />
                          <span className="flex-1 text-sm text-gray-900">{community.name}</span>
                          {pending && (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <label className="block mt-4">
                <span className="text-sm font-medium text-gray-900">
                  <FormattedMessage
                    id="common.settingsModal.minUrgencyLabel"
                    defaultMessage="Minimum urgency"
                  />
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  <FormattedMessage
                    id="common.settingsModal.minUrgencyDescription"
                    defaultMessage="Only notify me about posts at or above this urgency."
                  />
                </span>
                <select
                  value={minUrgency}
                  onChange={(e) => handleUrgencyChange(e.target.value as UrgencyLevel)}
                  disabled={urgencyMutation.isPending}
                  className="mt-2 block w-full rounded-lg border border-mayday-300 px-3 py-2 text-sm text-gray-900 focus:ring-mayday-500"
                >
                  {URGENCY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {intl.formatMessage(urgencyOptionMessages[level])}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-gray-900">
                  <FormattedMessage
                    id="common.settingsModal.frequencyLegend"
                    defaultMessage="Delivery"
                  />
                </legend>
                <p className="text-xs text-gray-500 mt-0.5">
                  <FormattedMessage
                    id="common.settingsModal.frequencyDescription"
                    defaultMessage="How often to send post notifications."
                  />
                </p>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="post-notification-frequency"
                      value="IMMEDIATE"
                      checked={frequency === 'IMMEDIATE'}
                      onChange={() => handleFrequencyChange('IMMEDIATE')}
                      disabled={frequencyMutation.isPending}
                      className="w-4 h-4 text-mayday-600 border-mayday-300 focus:ring-mayday-500"
                    />
                    <span className="text-sm text-gray-900">
                      <FormattedMessage
                        id="common.settingsModal.frequencyImmediate"
                        defaultMessage="Every new post"
                      />
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="post-notification-frequency"
                      value="WEEKLY"
                      checked={frequency === 'WEEKLY'}
                      onChange={() => handleFrequencyChange('WEEKLY')}
                      disabled={frequencyMutation.isPending}
                      className="w-4 h-4 text-mayday-600 border-mayday-300 focus:ring-mayday-500"
                    />
                    <span className="text-sm text-gray-900">
                      <FormattedMessage
                        id="common.settingsModal.frequencyWeekly"
                        defaultMessage="Weekly summary"
                      />
                    </span>
                    {frequencyMutation.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    )}
                  </label>
                </div>
              </fieldset>
            </div>

            <DevicesSection />
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-mayday-300 rounded-lg hover:bg-gray-50"
          >
            <FormattedMessage
              id="common.settingsModal.doneButton"
              defaultMessage="Done"
            />
          </button>
        </div>
      </div>
    </dialog>
  );
}
