import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { RegisterForm } from '../components/auth/RegisterForm.js';
import { resendVerification } from '../api/auth.js';
import type { RegisterRequest } from '@mayday/shared';

export function RegisterPage() {
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const prefilledEmail = searchParams.get('email')?.trim() || undefined;
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState('');

  const handleSubmit = async (data: RegisterRequest) => {
    setIsSubmitting(true);
    setError('');
    try {
      await register(data);
      setSubmittedEmail(data.email);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
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
      setResendError(err.response?.data?.error || 'Failed to resend. Try again shortly.');
    }
  };

  if (submittedEmail) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Check your inbox</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-gray-700">
            We've sent a confirmation link to <span className="font-medium">{submittedEmail}</span>.
            Click it to activate your account, then come back and log in.
          </p>
          <p className="text-sm text-gray-500">
            The link expires in 24 hours. Don't see the email? Check your spam folder.
          </p>
          <div className="pt-2 border-t border-gray-200">
            {resendState === 'sent' ? (
              <p className="text-sm text-green-700">Confirmation email resent.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === 'sending'}
                className="text-sm text-mayday-600 hover:text-mayday-700 font-medium disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
              </button>
            )}
            {resendError && <p className="text-sm text-red-600 mt-2">{resendError}</p>}
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">Back to log in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Join MayDay</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <RegisterForm onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} defaultEmail={prefilledEmail} />
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
