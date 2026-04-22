import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth.js';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Confirm your email</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {status === 'verifying' && <p className="text-gray-700">Verifying your email…</p>}
        {status === 'success' && (
          <>
            <p className="text-green-700">{message}</p>
            <p className="text-center">
              <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">Log in</Link>
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-600">{message}</p>
            <p className="text-center text-sm text-gray-600">
              Need a new link?{' '}
              <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">
                Go to log in
              </Link>{' '}
              and use <span className="font-medium">Resend confirmation email</span>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
