import { Plus, Trash2 } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import type { ProfileLink } from "@mayday/shared";

type LinksEditorProps = {
  value: ProfileLink[];
  onChange: (links: ProfileLink[]) => void;
  /** Optional id prefix so multiple editors on a page have stable, unique input ids. */
  idPrefix?: string;
};

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent";

/**
 * Strip empty rows and `undefined` labels from an editor value before sending it
 * to the server. Returns `undefined` if no valid rows remain so callers can omit
 * the `links` field entirely.
 */
export function cleanLinks(rows: ProfileLink[]): ProfileLink[] | undefined {
  const cleaned = rows
    .map((r) => ({
      label: r.label?.trim() || undefined,
      url: r.url.trim(),
    }))
    .filter((r) => r.url.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function LinksEditor({ value, onChange, idPrefix = "link" }: LinksEditorProps) {
  const intl = useIntl();

  const update = (index: number, patch: Partial<ProfileLink>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...value, { label: "", url: "" }]);
  };

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-2">
        <FormattedMessage
          defaultMessage="Links <opt>(optional)</opt>"
          values={{
            opt: (chunks) => (
              <span className="text-gray-500 font-normal">{chunks}</span>
            ),
          }}
        />
      </legend>
      {value.length > 0 && (
        <ul className="space-y-2 mb-2">
          {value.map((row, i) => (
            <li key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  id={`${idPrefix}-${i}-label`}
                  aria-label={intl.formatMessage({ defaultMessage: "Link label" })}
                  type="text"
                  placeholder={intl.formatMessage({
                    defaultMessage: "Label (e.g. Website)",
                  })}
                  value={row.label ?? ""}
                  onChange={(e) => update(i, { label: e.target.value })}
                  maxLength={50}
                  className={`${inputClass} sm:col-span-1`}
                />
                <input
                  id={`${idPrefix}-${i}-url`}
                  aria-label={intl.formatMessage({ defaultMessage: "Link URL" })}
                  type="url"
                  inputMode="url"
                  placeholder="https://example.org"
                  value={row.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  maxLength={500}
                  className={`${inputClass} sm:col-span-2`}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={intl.formatMessage(
                  { defaultMessage: "Remove link {n}" },
                  { n: i + 1 },
                )}
                className="mt-2 text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-sm text-mayday-700 hover:text-mayday-800"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <FormattedMessage defaultMessage="Add link" />
      </button>
    </fieldset>
  );
}
