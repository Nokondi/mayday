import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginRequest } from "@mayday/shared";
import { FormField } from "../common/FormField.js";

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, isSubmitting, error }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <FormField
        id="login-email"
        type="email"
        label="Email"
        error={errors.email?.message}
        {...register("email")}
      />

      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            {...register("password")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-mayday-500 rounded-r-lg"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Eye className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="text-red-500 text-sm mt-1">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-700 text-white text-md py-3 rounded-lg font-bold hover:bg-mayday-800 disabled:opacity-50"
      >
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
