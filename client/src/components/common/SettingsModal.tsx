import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateUserSettings } from '../../api/users.js';
import * as authApi from '../../api/auth.js';
import { useToastMutation } from '../../hooks/useToastMutation.js';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<boolean | null>(null);
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
    authApi.getMe()
      .then((me) => {
        if (cancelled) return;
        setEmailNotificationsEnabled(Boolean(me.emailNotificationsEnabled));
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Failed to load settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const mutation = useToastMutation({
    mutationFn: (next: boolean) => updateUserSettings({ emailNotificationsEnabled: next }),
    successMessage: 'Settings saved',
    errorMessage: 'Failed to update settings',
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
          <h2 id="settings-modal-title" className="text-lg font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-gray-500 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || emailNotificationsEnabled === null ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Email notifications</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotificationsEnabled}
                  onChange={(e) => handleToggle(e.target.checked)}
                  disabled={mutation.isPending}
                  className="mt-1 w-4 h-4 text-mayday-600 border-gray-300 rounded focus:ring-mayday-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Email me about activity</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    New messages from other users, and join requests for communities you administer.
                  </div>
                </div>
                {mutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
                )}
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
