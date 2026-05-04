import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportUserSchema, type ReportUserRequest } from "@mayday/shared";
import { reportUser } from "../../api/users.js";
import { FormField } from "../common/FormField.js";

export function ReportUserForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportUserRequest>({
    resolver: zodResolver(reportUserSchema),
  });

  const mutation = useMutation({
    mutationFn: reportUser,
    onSuccess: () => {
      toast.success("Report submitted — the admin team will review it.");
      reset();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error || "Failed to submit report";
      toast.error(msg);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-6"
      aria-label="Report a user"
      noValidate
    >
      <FormField
        id="report-email"
        type="email"
        label="User's email"
        error={errors.email?.message}
        placeholder="person@example.com"
        {...register("email")}
      />

      <FormField
        id="report-reason"
        label="Reason"
        error={errors.reason?.message}
        placeholder="Short summary (e.g. 'Harassing messages')"
        {...register("reason")}
      />

      <FormField
        multiline
        id="report-details"
        label="Details"
        optional
        error={errors.details?.message}
        rows={6}
        placeholder="What happened? Include context, approximate dates, or links to specific posts if relevant."
        {...register("details")}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
