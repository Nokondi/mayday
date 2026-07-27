import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { FormattedMessage, useIntl } from 'react-intl';
import { useAuth } from '../context/AuthContext.js';
import { RegisterForm } from '../components/auth/RegisterForm.js';
import { resendVerification } from '../api/auth.js';
import type { RegisterRequest } from '@mayday/shared';

export function RegisterPage() {
  const intl = useIntl();
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const prefilledEmail = searchParams.get('email')?.trim() || undefined;
  const [error, setError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState('');

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (_data, vars) => setSubmittedEmail(vars.email),
    onError: (err: any) => {
      setError(
        err.response?.data?.error ||
          intl.formatMessage({
            id: 'auth.registerPage.registrationFailedFallback',
            defaultMessage: 'Registration failed',
          }),
      );
    },
  });

  const handleSubmit = async (data: RegisterRequest) => {
    setError('');
    await registerMutation.mutateAsync(data).catch(() => {});
  };

  const handleResend = async () => {
    if (!submittedEmail) return;
    setResendState('sending');
    setResendError('');
    try {
      await resendVerification({ email: submittedEmail });
      setResendState('sent');
    } catch (err: any) {
      setResendState('idle');
      setResendError(
        err.response?.data?.error ||
          intl.formatMessage({
            id: 'auth.registerPage.resendFailedFallback',
            defaultMessage: 'Failed to resend. Try again shortly.',
          }),
      );
    }
  };

  if (submittedEmail) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          <FormattedMessage
            id="auth.checkInboxHeading"
            defaultMessage="Check your inbox"
          />
        </h1>
        <div className="bg-white rounded-lg border border-mayday-200 p-6 space-y-4">
          <p className="text-gray-700">
            <FormattedMessage
              id="auth.registerPage.confirmationSentMessage"
              defaultMessage="We've sent a confirmation link to <em>{email}</em>. Click it to activate your account, then come back and log in."
              values={{
                email: submittedEmail,
                em: (chunks) => <span className="font-medium">{chunks}</span>,
              }}
            />
          </p>
          <p className="text-sm text-gray-500">
            <FormattedMessage
              id="auth.registerPage.linkExpiryHint"
              defaultMessage="The link expires in 24 hours. Don't see the email? Check your spam folder."
            />
          </p>
          <div className="pt-2 border-t border-mayday-200">
            {resendState === 'sent' ? (
              <p role="status" className="text-sm text-green-700">
                <FormattedMessage
                  id="auth.registerPage.resendSuccessStatus"
                  defaultMessage="Confirmation email resent."
                />
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === 'sending'}
                className="text-sm text-mayday-600 hover:text-mayday-700 font-medium disabled:opacity-60"
              >
                {resendState === 'sending' ? (
                  <FormattedMessage
                    id="common.status.sending"
                    defaultMessage="Sending…"
                  />
                ) : (
                  <FormattedMessage
                    id="auth.registerPage.resendButton"
                    defaultMessage="Resend confirmation email"
                  />
                )}
              </button>
            )}
            {resendError && <p role="alert" className="text-sm text-red-600 mt-2">{resendError}</p>}
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">
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
        <FormattedMessage id="auth.registerPage.title" defaultMessage="Join MayDay" />
      </h1>
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <RegisterForm onSubmit={handleSubmit} isSubmitting={registerMutation.isPending} error={error} defaultEmail={prefilledEmail} />
        <p className="text-center text-sm text-gray-500 mt-4">
          <FormattedMessage
            id="auth.registerPage.loginPrompt"
            defaultMessage="Already have an account? <login>Log in</login>"
            values={{
              login: (chunks) => (
                <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">
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
