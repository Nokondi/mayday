import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createBugReportSchema,
  type CreateBugReportRequest,
} from "@mayday/shared";
import { submitBugReport } from "../../api/bugReports.js";
import { FormField } from "../common/FormField.js";

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
      <FormField
        id="bug-title"
        label="Title"
        error={errors.title?.message}
        placeholder="Short summary of the problem"
        {...register("title")}
      />

      <FormField
        multiline
        id="bug-description"
        label="Description"
        error={errors.description?.message}
        rows={8}
        placeholder="What did you expect to happen? What actually happened? Steps to reproduce?"
        {...register("description")}
      />

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
