import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerSchema, type RegisterRequest } from "@mayday/shared";
import { FormField } from "../common/FormField.js";
import { PasswordField } from "../common/PasswordField.js";

// Extends the shared register schema with a client-only confirmPassword field,
// matched against `password`. The server never sees confirmPassword.
const formSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

interface RegisterFormProps {
  onSubmit: (data: RegisterRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string;
  defaultEmail?: string;
}

export function RegisterForm({
  onSubmit,
  isSubmitting,
  error,
  defaultEmail,
}: RegisterFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultEmail ? { email: defaultEmail } : undefined,
  });

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSubmit({ name: data.name, email: data.email, password: data.password }),
      )}
      className="space-y-4"
    >
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <FormField
        id="register-name"
        label="Name"
        error={errors.name?.message}
        {...register("name")}
      />

      <FormField
        id="register-email"
        type="email"
        label="Email"
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="register-password"
        label="Password"
        error={errors.password?.message}
        {...register("password")}
      />

      <PasswordField
        id="register-confirm-password"
        label="Confirm password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
