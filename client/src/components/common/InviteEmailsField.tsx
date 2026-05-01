import type { ReactNode } from "react";
import { X, UserPlus } from "lucide-react";

type Props = {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  /** When provided, the component renders a form + submit button. */
  onSubmit?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Legend above the rows. Pass null to omit. */
  legend?: ReactNode | null;
  /** Helper text under the legend. Pass null to omit. */
  helpText?: ReactNode | null;
};

const DEFAULT_LEGEND = (
  <>
    Invite people <span className="text-gray-500 font-normal">(optional)</span>
  </>
);
const DEFAULT_HELP =
  "They'll get an email invite. People without a Mayday account will be invited to sign up.";

export function InviteEmailsField({
  emails,
  onEmailsChange,
  onSubmit,
  submitLabel = "Send invites",
  isSubmitting = false,
  legend = DEFAULT_LEGEND,
  helpText = DEFAULT_HELP,
}: Props) {
  const updateAt = (idx: number, value: string) =>
    onEmailsChange(emails.map((e, i) => (i === idx ? value : e)));
  const removeAt = (idx: number) =>
    onEmailsChange(emails.filter((_, i) => i !== idx));
  const addRow = () => onEmailsChange([...emails, ""]);

  const fieldset = (
    <fieldset className="border-0 p-0 m-0">
      {legend != null && (
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          {legend}
        </legend>
      )}
      {helpText != null && (
        <p className="text-xs text-gray-500 mb-2">{helpText}</p>
      )}
      <div className="space-y-2">
        {emails.map((email, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => updateAt(idx, e.target.value)}
              placeholder="friend@example.com"
              aria-label={`Email to invite ${idx + 1}`}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
            />
            {emails.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="px-2 text-gray-500 hover:text-red-600"
                aria-label="Remove email"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-sm text-mayday-600 hover:text-mayday-700 font-medium"
      >
        + Add another
      </button>
    </fieldset>
  );

  if (!onSubmit) return fieldset;

  const hasAny = emails.some((e) => e.trim().length > 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {fieldset}
      <button
        type="submit"
        disabled={isSubmitting || !hasAny}
        className="mt-4 flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
      >
        <UserPlus className="w-4 h-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}
