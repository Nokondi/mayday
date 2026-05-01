import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useBatchInvite } from "../../hooks/useBatchInvite.js";
import { InviteEmailsField } from "./InviteEmailsField.js";

type MemberLike = {
  id: string;
  role: string;
  user: { id: string; name: string };
};

type PendingInvite = {
  id: string;
  invitedUser?: { name: string } | null;
};

type InviteConfig = {
  /** Sends an invite for a single email. The component calls these in parallel via Promise.allSettled. */
  inviteEmail: (email: string) => Promise<unknown>;
  /** Pending invites to render under the email field. */
  pending?: PendingInvite[];
  /** Revokes a single invite by id. Required for the pending list's Revoke buttons to render. */
  revoke?: (inviteId: string) => Promise<unknown>;
  /** Called after invite send OR revoke finishes (use for query invalidation). */
  onSettled?: () => void;
};

type Props = {
  members: MemberLike[];
  defaultOpen?: boolean;
  /** When provided, invite UI is rendered inside the collapsible region. Gate this on admin/owner role at the call site. */
  invite?: InviteConfig;
};

export function MembersSection({
  members,
  defaultOpen = false,
  invite,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  const batch = useBatchInvite({
    inviteEmail: invite?.inviteEmail ?? (() => Promise.resolve()),
    onSettled: invite?.onSettled,
  });

  const handleRevoke = async (inviteId: string) => {
    if (!invite?.revoke) return;
    try {
      await invite.revoke(inviteId);
      toast.success("Invite revoked");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to revoke invite");
    }
    invite.onSettled?.();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          Members ({members.length})
        </h2>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={listId}>
          {invite && (
            <div className="mt-4 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Invite members
              </h3>
              <InviteEmailsField
                emails={batch.emails}
                onEmailsChange={batch.setEmails}
                onSubmit={batch.submit}
                isSubmitting={batch.isSubmitting}
                legend={null}
              />
              {invite.pending && invite.pending.length > 0 && invite.revoke && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Pending invites
                  </h3>
                  <ul className="divide-y divide-gray-100">
                    {invite.pending.map((inv) => (
                      <li
                        key={inv.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-900">
                          {inv.invitedUser?.name ?? "Pending invite"}
                        </span>
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <ul className="divide-y divide-gray-100 mt-4">
            {members.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <Link
                  to={`/profile/${m.user.id}`}
                  className="text-gray-900 hover:text-mayday-600"
                >
                  {m.user.name}
                </Link>
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}