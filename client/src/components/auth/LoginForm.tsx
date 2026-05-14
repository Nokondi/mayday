import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormattedMessage, useIntl } from "react-intl";
import { loginSchema, type LoginRequest } from "@mayday/shared";
import { FormField } from "../common/FormField.js";
import { PasswordField } from "../common/PasswordField.js";

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, isSubmitting, error }: LoginFormProps) {
  const intl = useIntl();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <FormField
        id="login-email"
        type="email"
        label={intl.formatMessage({
          id: "auth.loginForm.emailLabel",
          defaultMessage: "Email",
        })}
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="login-password"
        label={intl.formatMessage({
          id: "auth.loginForm.passwordLabel",
          defaultMessage: "Password",
        })}
        error={errors.password?.message}
        {...register("password")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-700 text-white text-md py-3 rounded-lg font-bold hover:bg-mayday-800 disabled:opacity-50"
      >
        {isSubmitting ? (
          <FormattedMessage
            id="auth.loginForm.submittingButton"
            defaultMessage="Logging in..."
          />
        ) : (
          <FormattedMessage
            id="auth.loginForm.submitButton"
            defaultMessage="Log in"
          />
        )}
      </button>
    </form>
  );
}
