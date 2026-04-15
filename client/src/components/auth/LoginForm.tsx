import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginRequest } from '@mayday/shared';

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, isSubmitting, error }: LoginFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="login-email"
          type="email"
          {...register('email')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          id="login-password"
          type="password"
          {...register('password')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-500 text-white py-3 rounded-lg font-medium hover:bg-mayday-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}
