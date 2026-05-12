import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "../api/auth.js";
import { PasswordField } from "../components/common/PasswordField.js";

// Extends the shared reset schema with a client-only confirmPassword field,
// matched against `password`. The server never sees confirmPassword.
const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      resetPassword({ token, password: data.password }),
  });

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Reset your password
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-red-600">Missing reset token.</p>
          <p className="text-sm text-gray-600">
            Please use the link in your password reset email, or{" "}
            <Link
              to="/forgot-password"
              className="text-mayday-600 hover:text-mayday-700 font-medium"
            >
              request a new one
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Password updated
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-green-700">Your password has been reset.</p>
          <p className="text-center">
            <Link
              to="/login"
              className="text-mayday-600 hover:text-mayday-700 font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const serverError =
    mutation.isError &&
    ((mutation.error as { response?: { data?: { error?: string } } })?.response
      ?.data?.error ||
      "Could not reset your password. The link may have expired.");

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
        Choose a new password
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
          noValidate
        >
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {serverError && (
            <p role="alert" className="text-red-600 text-sm">
              {serverError}
            </p>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-mayday-700 text-white py-2 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
