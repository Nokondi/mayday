import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIntl } from "react-intl";
import { reportUserSchema, type ReportUserRequest } from "@mayday/shared";
import { reportUser } from "../../api/users.js";
import { useToastMutation } from "../../hooks/useToastMutation.js";
import { FormField } from "../common/FormField.js";

export function ReportUserForm() {
  const intl = useIntl();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportUserRequest>({
    resolver: zodResolver(reportUserSchema),
  });

  const fallbackError = intl.formatMessage({
    id: "report.failedToast",
    defaultMessage: "Failed to submit report",
  });

  const mutation = useToastMutation({
    mutationFn: reportUser,
    successMessage: intl.formatMessage({
      id: "support.reportUserForm.successToast",
      defaultMessage: "Report submitted — the admin team will review it.",
    }),
    errorMessage: (err) =>
      (err as { response?: { data?: { error?: string } } }).response?.data
        ?.error || fallbackError,
    onSuccess: () => reset(),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-6"
      aria-label={intl.formatMessage({
        id: "support.reportUserForm.formAriaLabel",
        defaultMessage: "Report a user",
      })}
      noValidate
    >
      <FormField
        id="report-email"
        type="email"
        label={intl.formatMessage({
          id: "support.reportUserForm.emailLabel",
          defaultMessage: "User's email",
        })}
        error={errors.email?.message}
        placeholder={intl.formatMessage({
          id: "support.reportUserForm.emailPlaceholder",
          defaultMessage: "person@example.com",
        })}
        {...register("email")}
      />

      <FormField
        id="report-reason"
        label={intl.formatMessage({
          id: "support.reportUserForm.reasonLabel",
          defaultMessage: "Reason",
        })}
        error={errors.reason?.message}
        placeholder={intl.formatMessage({
          id: "support.reportUserForm.reasonPlaceholder",
          defaultMessage: "Short summary (e.g. 'Harassing messages')",
        })}
        {...register("reason")}
      />

      <FormField
        multiline
        id="report-details"
        label={intl.formatMessage({
          id: "support.reportUserForm.detailsLabel",
          defaultMessage: "Details",
        })}
        optional
        error={errors.details?.message}
        rows={6}
        placeholder={intl.formatMessage({
          id: "support.reportUserForm.detailsPlaceholder",
          defaultMessage: "What happened? Include context, approximate dates, or links to specific posts if relevant.",
        })}
        {...register("details")}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {mutation.isPending
          ? intl.formatMessage({
              id: "report.submittingButton",
              defaultMessage: "Submitting…",
            })
          : intl.formatMessage({
              id: "support.reportUserForm.submitButton",
              defaultMessage: "Submit Report",
            })}
      </button>
    </form>
  );
}
