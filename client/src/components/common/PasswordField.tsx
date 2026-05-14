import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useIntl } from "react-intl";

type PasswordFieldProps = {
  id: string;
  label: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

export function PasswordField({
  id,
  label,
  error,
  ...rest
}: PasswordFieldProps) {
  const intl = useIntl();
  const [showPassword, setShowPassword] = useState(false);
  const errorId = error ? `${id}-error` : undefined;

  const toggleLabel = showPassword
    ? intl.formatMessage({
        id: "common.passwordField.hideAriaLabel",
        defaultMessage: "Hide password",
      })
    : intl.formatMessage({
        id: "common.passwordField.showAriaLabel",
        defaultMessage: "Show password",
      });

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-mayday-500 rounded-r-lg"
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Eye className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-red-500 text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
