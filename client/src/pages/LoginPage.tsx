import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LoginForm } from '../components/auth/LoginForm.js';
import type { LoginRequest } from '@mayday/shared';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (data: LoginRequest) => {
    setIsSubmitting(true);
    setError('');
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Log in to MayDay</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} />
        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-mayday-600 hover:text-mayday-700 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
