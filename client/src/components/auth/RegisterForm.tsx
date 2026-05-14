import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormattedMessage, useIntl } from "react-intl";
import { registerSchema, type RegisterRequest } from "@mayday/shared";
import { FormField } from "../common/FormField.js";
import { PasswordField } from "../common/PasswordField.js";

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onSubmit: (data: RegisterRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
  defaultEmail?: string;
}

export function RegisterForm({
  onSubmit,
  isSubmitting,
  error,
  defaultEmail,
}: RegisterFormProps) {
  const intl = useIntl();

  // Schema is memoized on intl so its message strings are translated. The
  // client-only `confirmPassword` field is matched against `password` here;
  // the server never sees it.
  const formSchema = useMemo(
    () =>
      registerSchema
        .extend({
          confirmPassword: z.string().min(
            1,
            intl.formatMessage({ defaultMessage: "Please confirm your password" }),
          ),
        })
        .refine((v) => v.password === v.confirmPassword, {
          message: intl.formatMessage({ defaultMessage: "Passwords do not match" }),
          path: ["confirmPassword"],
        }),
    [intl],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultEmail ? { email: defaultEmail } : undefined,
  });

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSubmit({ name: data.name, email: data.email, password: data.password }),
      )}
      className="space-y-4"
    >
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <FormField
        id="register-name"
        label={intl.formatMessage({ defaultMessage: "Name" })}
        error={errors.name?.message}
        {...register("name")}
      />

      <FormField
        id="register-email"
        type="email"
        label={intl.formatMessage({ defaultMessage: "Email" })}
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="register-password"
        label={intl.formatMessage({ defaultMessage: "Password" })}
        error={errors.password?.message}
        {...register("password")}
      />

      <PasswordField
        id="register-confirm-password"
        label={intl.formatMessage({ defaultMessage: "Confirm password" })}
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {isSubmitting ? (
          <FormattedMessage defaultMessage="Creating account..." />
        ) : (
          <FormattedMessage defaultMessage="Create account" />
        )}
      </button>
    </form>
  );
}
