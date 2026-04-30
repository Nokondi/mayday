import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportUserSchema, type ReportUserRequest } from "@mayday/shared";
import { reportUser } from "../../api/users.js";

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
      <div>
        <label
          htmlFor="report-email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          User's email
        </label>
        <input
          id="report-email"
          type="email"
          {...register("email")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="person@example.com"
        />
        {errors.email && (
          <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="report-reason"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Reason
        </label>
        <input
          id="report-reason"
          {...register("reason")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="Short summary (e.g. 'Harassing messages')"
        />
        {errors.reason && (
          <p className="text-red-500 text-sm mt-1">{errors.reason.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="report-details"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Details <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          id="report-details"
          {...register("details")}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="What happened? Include context, approximate dates, or links to specific posts if relevant."
        />
        {errors.details && (
          <p className="text-red-500 text-sm mt-1">{errors.details.message}</p>
        )}
      </div>

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
