import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { RegisterForm } from '../components/auth/RegisterForm.js';
import type { RegisterRequest } from '@mayday/shared';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: RegisterRequest) => {
    setIsSubmitting(true);
    setError('');
    try {
      await register(data);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">Join MayDay</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <RegisterForm onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} />
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-mayday-600 hover:text-mayday-700 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
