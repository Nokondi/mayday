import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TransferOwnershipDialog,
  type TransferOwnershipCandidate,
} from '../../../src/components/common/TransferOwnershipDialog.js';

function renderDialog(overrides: {
  candidates?: TransferOwnershipCandidate[];
  groupKind?: 'community' | 'organization';
  groupName?: string;
  onTransfer?: (id: string) => Promise<void>;
  onClose?: () => void;
  isPending?: boolean;
} = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onTransfer = overrides.onTransfer ?? vi.fn().mockResolvedValue(undefined);
  render(
    <TransferOwnershipDialog
      open
      onClose={onClose}
      groupKind={overrides.groupKind ?? 'community'}
      groupName={overrides.groupName ?? 'Sunset Mutual Aid'}
      candidates={
        overrides.candidates ?? [
          { userId: 'u2', name: 'Alex Chen', role: 'ADMIN' },
          { userId: 'u3', name: 'Dana Park', role: 'MEMBER' },
        ]
      }
      onTransfer={onTransfer}
      isPending={overrides.isPending ?? false}
    />,
  );
  return { onClose, onTransfer };
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('TransferOwnershipDialog', () => {
  it('renders one radio per candidate', () => {
    renderDialog();
    expect(screen.getByRole('radio', { name: /alex chen/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dana park/i })).toBeInTheDocument();
  });

  it('disables submit until a candidate is selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    const submit = screen.getByRole('button', { name: /transfer ownership/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /alex chen/i }));
    expect(screen.getByRole('button', { name: /make alex chen owner/i })).toBeEnabled();
  });

  it('calls onTransfer with the selected userId on confirm', async () => {
    const user = userEvent.setup();
    const onTransfer = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onTransfer });

    await user.click(screen.getByRole('radio', { name: /dana park/i }));
    await user.click(screen.getByRole('button', { name: /make dana park owner/i }));

    expect(onTransfer).toHaveBeenCalledWith('u3');
  });

  it('shows an empty-state message when there are no candidates', () => {
    renderDialog({ candidates: [], groupKind: 'organization' });
    expect(screen.getByText(/no other members to transfer to/i)).toBeInTheDocument();
    expect(screen.getByText(/delete the organization/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transfer ownership/i })).toBeDisabled();
  });

  it('cancel button invokes onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
