import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { verifyEmail } from '../api/auth.js';

type Status = 'idle' | 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const intl = useIntl();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Verification must be gated behind an explicit click: some mail providers
  // (Gmail, Microsoft Safe Links, etc.) prefetch links in messages to scan
  // them. If we verify on page load, the scanner burns the token before the
  // user ever clicks.
  const handleConfirm = async () => {
    if (!token) {
      setStatus('error');
      setMessage(
        intl.formatMessage({
          id: 'auth.verifyEmailPage.missingTokenError',
          defaultMessage: 'Missing verification token.',
        }),
      );
      return;
    }

    setStatus('verifying');
    try {
      const res = await verifyEmail(token);
      setStatus('success');
      setMessage(res.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(
        err.response?.data?.error ||
          intl.formatMessage({
            id: 'auth.verifyEmailPage.verificationFailedFallback',
            defaultMessage: 'Verification failed.',
          }),
      );
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
        <FormattedMessage
          id="auth.verifyEmailPage.title"
          defaultMessage="Confirm your email"
        />
      </h1>
      <div className="bg-white rounded-lg border border-mayday-200 p-6 space-y-4">
        {status === 'idle' && (
          <>
            <p className="text-gray-700">
              <FormattedMessage
                id="auth.verifyEmailPage.idleInstructions"
                defaultMessage="Click the button below to finish confirming your email address."
              />
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!token}
              className="w-full bg-mayday-600 hover:bg-mayday-700 text-white font-medium py-2 rounded-md disabled:opacity-60"
            >
              <FormattedMessage
                id="auth.verifyEmailPage.confirmButton"
                defaultMessage="Confirm my email"
              />
            </button>
            {!token && (
              <p className="text-sm text-red-600">
                <FormattedMessage
                  id="auth.verifyEmailPage.missingTokenError"
                  defaultMessage="Missing verification token."
                />
              </p>
            )}
          </>
        )}
        {status === 'verifying' && (
          <p role="status" className="text-gray-700">
            <FormattedMessage
              id="auth.verifyEmailPage.verifyingStatus"
              defaultMessage="Verifying your email…"
            />
          </p>
        )}
        {status === 'success' && (
          <>
            <p role="status" className="text-green-700">{message}</p>
            <p className="text-center">
              <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">
                <FormattedMessage
                  id="common.actions.login"
                  defaultMessage="Log in"
                />
              </Link>
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p role="alert" className="text-red-600">{message}</p>
            <p className="text-center text-sm text-gray-600">
              <FormattedMessage
                id="auth.verifyEmailPage.errorRecoveryInstructions"
                defaultMessage="Need a new link? <login>Go to log in</login> and use <action>Resend confirmation email</action>."
                values={{
                  login: (chunks) => (
                    <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">
                      {chunks}
                    </Link>
                  ),
                  action: (chunks) => <span className="font-medium">{chunks}</span>,
                }}
              />
            </p>
          </>
        )}
      </div>
    </div>
  );
}
