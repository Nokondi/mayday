import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import type { CommunityWithMembership, UrgencyLevel } from '@mayday/shared';
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
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<boolean | null>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState<boolean | null>(null);
  const [notifyFriendPosts, setNotifyFriendPosts] = useState<boolean | null>(null);
  const [minUrgency, setMinUrgency] = useState<UrgencyLevel | null>(null);
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
        setEmailNotificationsEnabled(Boolean(me.emailNotificationsEnabled));
        setPushNotificationsEnabled(Boolean(me.pushNotificationsEnabled));
        setNotifyFriendPosts(Boolean(me.notifyFriendPosts));
        setMinUrgency((me.minPostNotificationUrgency as UrgencyLevel) ?? 'LOW');
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

  const mutation = useToastMutation({
    mutationFn: (next: boolean) => updateUserSettings({ emailNotificationsEnabled: next }),
    successMessage: savedToast,
    errorMessage: updateFailedToast,
    onError: (_err, attemptedValue) => {
      // Revert optimistic update
      setEmailNotificationsEnabled(!attemptedValue);
    },
    onSuccess: (data) => {
      setEmailNotificationsEnabled(data.emailNotificationsEnabled);
    },
  });

  const handleToggle = (next: boolean) => {
    setEmailNotificationsEnabled(next);
    mutation.mutate(next);
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
          || emailNotificationsEnabled === null
          || pushNotificationsEnabled === null
          || notifyFriendPosts === null
          || minUrgency === null
          || communities === null ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                <FormattedMessage
                  id="common.settingsModal.emailNotificationsHeading"
                  defaultMessage="Email notifications"
                />
              </h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotificationsEnabled}
                  onChange={(e) => handleToggle(e.target.checked)}
                  disabled={mutation.isPending}
                  className="mt-1 w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    <FormattedMessage
                      id="common.settingsModal.emailToggleLabel"
                      defaultMessage="Email me about activity"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <FormattedMessage
                      id="common.settingsModal.emailToggleDescription"
                      defaultMessage="New messages from other users, and join requests for communities you administer."
                    />
                  </div>
                </div>
                {mutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
                )}
              </label>
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

              {communities.length > 0 && (
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-gray-900">
                    <FormattedMessage
                      id="common.settingsModal.communityPostsLegend"
                      defaultMessage="Communities"
                    />
                  </legend>
                  <p className="text-xs text-gray-500 mt-0.5">
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
