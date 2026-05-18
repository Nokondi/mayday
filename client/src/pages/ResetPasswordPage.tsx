import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormattedMessage, useIntl } from "react-intl";
import { resetPassword } from "../api/auth.js";
import { PasswordField } from "../components/common/PasswordField.js";

interface FormData {
  password: string;
  confirmPassword: string;
}

export function ResetPasswordPage() {
  const intl = useIntl();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Schema is memoized on intl so its message strings are translated. The
  // client-only `confirmPassword` field is matched against `password` here;
  // the server never sees it.
  const formSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(
              8,
              intl.formatMessage({
                id: "auth.resetPasswordPage.passwordTooShortError",
                defaultMessage: "Password must be at least 8 characters",
              }),
            ),
          confirmPassword: z
            .string()
            .min(
              1,
              intl.formatMessage({
                id: "auth.resetPasswordPage.confirmPasswordRequiredError",
                defaultMessage: "Please confirm your new password",
              }),
            ),
        })
        .refine((v) => v.password === v.confirmPassword, {
          message: intl.formatMessage({
            id: "common.errors.passwordsMismatch",
            defaultMessage: "Passwords do not match",
          }),
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
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      resetPassword({ token, password: data.password }),
  });

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          <FormattedMessage
            id="auth.resetPasswordTitle"
            defaultMessage="Reset your password"
          />
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-red-600">
            <FormattedMessage
              id="auth.resetPasswordPage.missingTokenError"
              defaultMessage="Missing reset token."
            />
          </p>
          <p className="text-sm text-gray-600">
            <FormattedMessage
              id="auth.resetPasswordPage.missingTokenInstructions"
              defaultMessage="Please use the link in your password reset email, or <request>request a new one</request>."
              values={{
                request: (chunks) => (
                  <Link
                    to="/forgot-password"
                    className="text-mayday-600 hover:text-mayday-700 font-medium"
                  >
                    {chunks}
                  </Link>
                ),
              }}
            />
          </p>
        </div>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          <FormattedMessage
            id="auth.resetPasswordPage.successHeading"
            defaultMessage="Password updated"
          />
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-green-700">
            <FormattedMessage
              id="auth.resetPasswordPage.successMessage"
              defaultMessage="Your password has been reset."
            />
          </p>
          <p className="text-center">
            <Link
              to="/login"
              className="text-mayday-600 hover:text-mayday-700 font-medium"
            >
              <FormattedMessage
                id="common.actions.login"
                defaultMessage="Log in"
              />
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const serverError =
    mutation.isError &&
    ((mutation.error as { response?: { data?: { error?: string } } })?.response
      ?.data?.error ||
      intl.formatMessage({
        id: "auth.resetPasswordPage.resetFailedFallback",
        defaultMessage: "Could not reset your password. The link may have expired.",
      }));

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
        <FormattedMessage
          id="auth.resetPasswordPage.title"
          defaultMessage="Choose a new password"
        />
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
          noValidate
        >
          <PasswordField
            id="new-password"
            label={intl.formatMessage({
              id: "auth.resetPasswordPage.newPasswordLabel",
              defaultMessage: "New password",
            })}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            id="confirm-password"
            label={intl.formatMessage({
              id: "auth.resetPasswordPage.confirmPasswordLabel",
              defaultMessage: "Confirm new password",
            })}
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {serverError && (
            <p role="alert" className="text-red-600 text-sm">
              {serverError}
            </p>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-mayday-700 text-white py-2 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <FormattedMessage
                id="auth.resetPasswordPage.submittingButton"
                defaultMessage="Saving…"
              />
            ) : (
              <FormattedMessage
                id="auth.resetPasswordPage.submitButton"
                defaultMessage="Update password"
              />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
