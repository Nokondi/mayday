import { useState } from "react";
import { toast } from "sonner";

type Options = {
  /** Sends an invite for a single email. The hook calls this in parallel via Promise.allSettled. */
  inviteEmail: (email: string) => Promise<unknown>;
  /** Called after a batch finishes, regardless of partial failures (use for query invalidation). */
  onSettled?: () => void;
};

export function useBatchInvite({ inviteEmail, onSettled }: Options) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const cleaned = Array.from(
      new Set(emails.map((e) => e.trim()).filter(Boolean)),
    );
    if (cleaned.length === 0) return;

    setIsSubmitting(true);
    const results = await Promise.allSettled(cleaned.map(inviteEmail));
    setIsSubmitting(false);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failures = results
      .map((r, i) => ({ result: r, email: cleaned[i] }))
      .filter((x) => x.result.status === "rejected") as Array<{
      result: PromiseRejectedResult;
      email: string;
    }>;

    if (ok && !failures.length) {
      toast.success(`${ok} invite${ok === 1 ? "" : "s"} sent`);
    } else if (failures.length === 1 && cleaned.length === 1) {
      toast.error(
        (failures[0].result.reason as any)?.response?.data?.message ||
          "Failed to send invite",
      );
    } else if (ok) {
      toast.success(`${ok} sent, ${failures.length} failed`);
    } else {
      toast.error(
        `Failed to send ${failures.length} invite${failures.length === 1 ? "" : "s"}`,
      );
    }

    setEmails(failures.length ? failures.map((f) => f.email) : [""]);
    onSettled?.();
  };

  return { emails, setEmails, isSubmitting, submit };
}
