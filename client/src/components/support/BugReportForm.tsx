import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createBugReportSchema,
  type CreateBugReportRequest,
} from "@mayday/shared";
import { submitBugReport } from "../../api/bugReports.js";

export function BugReportForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBugReportRequest>({
    resolver: zodResolver(createBugReportSchema),
  });

  const mutation = useMutation({
    mutationFn: submitBugReport,
    onSuccess: () => {
      toast.success("Bug report submitted — thank you!");
      reset();
    },
    onError: () => toast.error("Failed to submit bug report"),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-6"
      aria-label="Report a bug"
    >
      <div>
        <label
          htmlFor="bug-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title
        </label>
        <input
          id="bug-title"
          {...register("title")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="Short summary of the problem"
        />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="bug-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="bug-description"
          {...register("description")}
          rows={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="What did you expect to happen? What actually happened? Steps to reproduce?"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">
            {errors.description.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-mayday-700 text-white font-bold py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting..." : "Submit Bug Report"}
      </button>
    </form>
  );
}
