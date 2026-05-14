import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { FormattedMessage, useIntl } from "react-intl";
import { useAuth } from "../context/AuthContext.js";
import { LoginForm } from "../components/auth/LoginForm.js";
import { resendVerification } from "../api/auth.js";
import type { LoginRequest } from "@mayday/shared";

export function LoginPage() {
  const intl = useIntl();
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  const from = (location.state as any)?.from?.pathname || "/";

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate(from, { replace: true }),
    onError: (err: any, vars) => {
      const status = err.response?.status;
      const message =
        err.response?.data?.error ||
        intl.formatMessage({
          id: "auth.loginPage.loginFailedFallback",
          defaultMessage: "Login failed",
        });
      setError(message);
      if (status === 403 && /confirm your email/i.test(message)) {
        setUnverifiedEmail(vars.email);
      }
    },
  });

  const handleSubmit = async (data: LoginRequest) => {
    setError("");
    setUnverifiedEmail(null);
    setResendState("idle");
    await loginMutation.mutateAsync(data).catch(() => {});
  };

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mayday-500" />
        <span className="sr-only">
          <FormattedMessage
            id="common.loadingSpinner.srLabel"
            defaultMessage="Loading..."
          />
        </span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResendState("sending");
    try {
      await resendVerification({ email: unverifiedEmail });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
        <FormattedMessage id="auth.loginPage.title" defaultMessage="Log in to MayDay" />
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LoginForm
          onSubmit={handleSubmit}
          isSubmitting={loginMutation.isPending}
          error={error}
        />
        {unverifiedEmail && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            {resendState === "sent" ? (
              <p role="status" className="text-gray-700">
                <FormattedMessage
                  id="auth.loginPage.resendConfirmationSent"
                  defaultMessage="Sent a new confirmation link to <em>{email}</em>."
                  values={{
                    email: unverifiedEmail,
                    em: (chunks) => (
                      <span className="font-medium">{chunks}</span>
                    ),
                  }}
                />
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === "sending"}
                className="text-mayday-700 hover:text-mayday-800 font-medium disabled:opacity-60"
              >
                {resendState === "sending" ? (
                  <FormattedMessage
                    id="common.status.sending"
                    defaultMessage="Sending…"
                  />
                ) : (
                  <FormattedMessage
                    id="auth.loginPage.resendButton"
                    defaultMessage="Resend confirmation email to {email}"
                    values={{ email: unverifiedEmail }}
                  />
                )}
              </button>
            )}
          </div>
        )}
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link
            to="/forgot-password"
            className="text-mayday-700 hover:text-mayday-800 font-medium"
          >
            <FormattedMessage
              id="auth.loginPage.forgotPasswordLink"
              defaultMessage="Forgot your password?"
            />
          </Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          <FormattedMessage
            id="auth.loginPage.signupPrompt"
            defaultMessage="Don't have an account? <signup>Sign up</signup>"
            values={{
              signup: (chunks) => (
                <Link
                  to="/register"
                  className="text-mayday-700 hover:text-mayday-800 font-medium"
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
