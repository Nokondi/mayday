import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type CommonProps = {
  id: string;
  label: ReactNode;
  error?: string;
  optional?: boolean;
};

type FormFieldProps =
  | (CommonProps & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  | (CommonProps & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>);

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent";

export function FormField(props: FormFieldProps) {
  const { id, label, error, optional, multiline, ...rest } = props;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {optional && (
          <>
            {" "}
            <span className="text-gray-500 font-normal">(optional)</span>
          </>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={inputClass}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={inputClass}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error && (
        <p id={errorId} className="text-red-500 text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
