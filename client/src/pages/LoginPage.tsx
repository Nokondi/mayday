import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LoginForm } from '../components/auth/LoginForm.js';
import { resendVerification } from '../api/auth.js';
import type { LoginRequest } from '@mayday/shared';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (data: LoginRequest) => {
    setIsSubmitting(true);
    setError('');
    setUnverifiedEmail(null);
    setResendState('idle');
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      if (status === 403 && /confirm your email/i.test(message)) {
        setUnverifiedEmail(data.email);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResendState('sending');
    try {
      await resendVerification({ email: unverifiedEmail });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Log in to MayDay</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} />
        {unverifiedEmail && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            {resendState === 'sent' ? (
              <p className="text-gray-700">
                Sent a new confirmation link to <span className="font-medium">{unverifiedEmail}</span>.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === 'sending'}
                className="text-mayday-700 hover:text-mayday-800 font-medium disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending…' : `Resend confirmation email to ${unverifiedEmail}`}
              </button>
            )}
          </div>
        )}
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/forgot-password" className="text-mayday-600 hover:text-mayday-700 font-medium">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          Don't have an account?{' '}
          <Link to="/register" className="text-mayday-600 hover:text-mayday-700 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
