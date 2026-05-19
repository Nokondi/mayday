import { useEffect, useRef, useState } from 'react';
import { Crown, X } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';

export interface TransferOwnershipCandidate {
  userId: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
}

interface TransferOwnershipDialogProps {
  open: boolean;
  onClose: () => void;
  groupKind: 'community' | 'organization';
  groupName: string;
  candidates: TransferOwnershipCandidate[];
  /** Called with the chosen heir's userId. Resolves on success; reject keeps the dialog open. */
  onTransfer: (newOwnerId: string) => Promise<void>;
  isPending: boolean;
}

export function TransferOwnershipDialog({
  open,
  onClose,
  groupKind,
  groupName,
  candidates,
  onTransfer,
  isPending,
}: TransferOwnershipDialogProps) {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string>('');

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

  // Reset selection each time the dialog re-opens.
  useEffect(() => {
    if (open) setSelectedId('');
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    try {
      await onTransfer(selectedId);
    } catch {
      // Parent surfaces the toast; keep the dialog open for retry.
    }
  };

  const selectedCandidate = candidates.find((c) => c.userId === selectedId);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="transfer-ownership-title"
      className="rounded-lg p-0 backdrop:bg-black/50 max-w-md w-full"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="transfer-ownership-title"
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
          >
            <Crown className="w-5 h-5 text-amber-600" aria-hidden="true" />
            <FormattedMessage
              id="groups.transferOwnership.title"
              defaultMessage="Transfer ownership"
            />
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={intl.formatMessage({
              id: 'common.actions.close',
              defaultMessage: 'Close',
            })}
            className="text-gray-500 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-700">
          <FormattedMessage
            id="groups.transferOwnership.dialogBody"
            defaultMessage="Pick a member to become the new owner of <strong>{groupName}</strong>. You'll be demoted to <strong>Admin</strong>. This can't be undone from the {kind, select, community {community} organization {organization} other {group}} page — the new owner will have to hand it back."
            values={{
              groupName,
              kind: groupKind,
              strong: (chunks) => <strong>{chunks}</strong>,
            }}
          />
        </p>

        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            <FormattedMessage
              id="groups.transferOwnership.emptyState"
              defaultMessage="There are no other members to transfer to. Invite someone first, or delete the {kind, select, community {community} organization {organization} other {group}} from the danger zone."
              values={{ kind: groupKind }}
            />
          </p>
        ) : (
          <fieldset className="mt-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            <legend className="sr-only">
              <FormattedMessage
                id="groups.transferOwnership.selectNewOwnerLegend"
                defaultMessage="Select new owner"
              />
            </legend>
            {candidates.map((c) => {
              const inputId = `transfer-candidate-${c.userId}`;
              return (
                <label
                  key={c.userId}
                  htmlFor={inputId}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="transfer-new-owner"
                    value={c.userId}
                    checked={selectedId === c.userId}
                    onChange={() => setSelectedId(c.userId)}
                    disabled={isPending}
                    className="w-4 h-4 text-mayday-600 border-gray-300 focus:ring-mayday-500"
                  />
                  <span className="flex-1 text-sm text-gray-900 truncate">
                    {c.name}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-gray-500">
                    {c.role}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FormattedMessage
              id="common.actions.cancel"
              defaultMessage="Cancel"
            />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedId || isPending || candidates.length === 0}
            className="flex items-center gap-2 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
          >
            <Crown className="w-4 h-4" aria-hidden="true" />
            {isPending ? (
              <FormattedMessage
                id="groups.transferOwnership.transferringButton"
                defaultMessage="Transferring…"
              />
            ) : selectedCandidate ? (
              <FormattedMessage
                id="groups.transferOwnership.makeOwnerButton"
                defaultMessage="Make {name} owner"
                values={{ name: selectedCandidate.name }}
              />
            ) : (
              <FormattedMessage
                id="groups.transferOwnership.title"
                defaultMessage="Transfer ownership"
              />
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
