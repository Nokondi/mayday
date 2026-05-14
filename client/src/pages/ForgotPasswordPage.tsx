import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormattedMessage, useIntl } from "react-intl";
import {
  forgotPasswordSchema,
  type ForgotPasswordRequest,
} from "@mayday/shared";
import { forgotPassword } from "../api/auth.js";

export function ForgotPasswordPage() {
  const intl = useIntl();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (_res, variables) => setSubmittedEmail(variables.email),
  });

  if (submittedEmail) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          <FormattedMessage
            id="auth.checkInboxHeading"
            defaultMessage="Check your inbox"
          />
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-gray-700">
            <FormattedMessage
              id="auth.forgotPasswordPage.confirmationSentMessage"
              defaultMessage="If <em>{email}</em> matches a Mayday account, we've sent a password reset link. Click it to choose a new password."
              values={{
                email: submittedEmail,
                em: (chunks) => <span className="font-medium">{chunks}</span>,
              }}
            />
          </p>
          <p className="text-sm text-gray-500">
            <FormattedMessage
              id="auth.forgotPasswordPage.linkExpiryHint"
              defaultMessage="The link expires in 1 hour. Don't see it? Check your spam folder, or try again in a few minutes."
            />
          </p>
          <p className="text-center text-sm text-gray-500 pt-2 border-t border-gray-200">
            <Link
              to="/login"
              className="text-mayday-600 hover:text-mayday-700 font-medium"
            >
              <FormattedMessage
                id="auth.backToLogin"
                defaultMessage="Back to log in"
              />
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
        <FormattedMessage
          id="auth.resetPasswordTitle"
          defaultMessage="Reset your password"
        />
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-4">
          <FormattedMessage
            id="auth.forgotPasswordPage.instructions"
            defaultMessage="Enter the email address you signed up with and we'll send you a link to choose a new password."
          />
        </p>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              <FormattedMessage
                id="common.fields.email"
                defaultMessage="Email"
              />
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "forgot-email-error" : undefined}
              {...register("email")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder={intl.formatMessage({
                id: "auth.forgotPasswordPage.emailPlaceholder",
                defaultMessage: "you@example.com",
              })}
            />
            {errors.email && (
              <p id="forgot-email-error" className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-mayday-700 text-white py-2 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <FormattedMessage
                id="common.status.sending"
                defaultMessage="Sending…"
              />
            ) : (
              <FormattedMessage
                id="auth.forgotPasswordPage.submitButton"
                defaultMessage="Send reset link"
              />
            )}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          <FormattedMessage
            id="auth.forgotPasswordPage.loginPrompt"
            defaultMessage="Remembered it? <login>Back to log in</login>"
            values={{
              login: (chunks) => (
                <Link
                  to="/login"
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
