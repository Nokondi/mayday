import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIntl } from "react-intl";
import {
  createBugReportSchema,
  type CreateBugReportRequest,
} from "@mayday/shared";
import { submitBugReport } from "../../api/bugReports.js";
import { useToastMutation } from "../../hooks/useToastMutation.js";
import { FormField } from "../common/FormField.js";

export function BugReportForm() {
  const intl = useIntl();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBugReportRequest>({
    resolver: zodResolver(createBugReportSchema),
  });

  const mutation = useToastMutation({
    mutationFn: submitBugReport,
    successMessage: intl.formatMessage({
      id: "support.bugReportForm.successToast",
      defaultMessage: "Bug report submitted — thank you!",
    }),
    errorMessage: intl.formatMessage({
      id: "support.bugReportForm.failedToast",
      defaultMessage: "Failed to submit bug report",
    }),
    onSuccess: () => reset(),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-6"
      aria-label={intl.formatMessage({
        id: "support.bugReportForm.formAriaLabel",
        defaultMessage: "Report a bug",
      })}
    >
      <FormField
        id="bug-title"
        label={intl.formatMessage({
          id: "support.bugReportForm.titleLabel",
          defaultMessage: "Title",
        })}
        error={errors.title?.message}
        placeholder={intl.formatMessage({
          id: "support.bugReportForm.titlePlaceholder",
          defaultMessage: "Short summary of the problem",
        })}
        {...register("title")}
      />

      <FormField
        multiline
        id="bug-description"
        label={intl.formatMessage({
          id: "support.bugReportForm.descriptionLabel",
          defaultMessage: "Description",
        })}
        error={errors.description?.message}
        rows={8}
        placeholder={intl.formatMessage({
          id: "support.bugReportForm.descriptionPlaceholder",
          defaultMessage: "What did you expect to happen? What actually happened? Steps to reproduce?",
        })}
        {...register("description")}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-mayday-700 text-white font-bold py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {mutation.isPending
          ? intl.formatMessage({
              id: "support.bugReportForm.submittingButton",
              defaultMessage: "Submitting...",
            })
          : intl.formatMessage({
              id: "support.bugReportForm.submitButton",
              defaultMessage: "Submit Bug Report",
            })}
      </button>
    </form>
  );
}
