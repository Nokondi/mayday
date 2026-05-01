import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createOrganizationSchema,
  type CreateOrganizationRequest,
} from "@mayday/shared";
import {
  createOrganization,
  inviteToOrganization,
} from "../api/organizations.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationRequest>({
    resolver: zodResolver(createOrganizationSchema),
  });

  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });

      const emails = Array.from(
        new Set(inviteEmails.map((e) => e.trim()).filter(Boolean)),
      );
      if (emails.length > 0) {
        const results = await Promise.allSettled(
          emails.map((email) => inviteToOrganization(org.id, { email })),
        );
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const failed = emails.length - ok;
        if (ok && !failed) {
          toast.success(
            `Organization created · ${ok} invite${ok === 1 ? "" : "s"} sent`,
          );
        } else if (ok && failed) {
          toast.success(
            `Organization created · ${ok} invited, ${failed} failed`,
          );
        } else {
          toast.success("Organization created · invites failed to send");
        }
      } else {
        toast.success("Organization created");
      }
      navigate(`/organizations/${org.id}`);
    },
    onError: () => toast.error("Failed to create organization"),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create an Organization
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form
          onSubmit={handleSubmit((data) => {
            // Strip empty optional fields so URL/length validators don't fire
            const clean: CreateOrganizationRequest = { name: data.name };
            if (data.description) clean.description = data.description;
            if (data.location) clean.location = data.location;
            if (data.avatarUrl) clean.avatarUrl = data.avatarUrl;
            mutation.mutate(clean);
          })}
          className="space-y-6"
        >
          <div>
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="org-name"
              {...register("name")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="e.g. Riverside Mutual Aid"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="org-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="org-description"
              {...register("description")}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="What does your organization do?"
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="org-location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              id="org-location"
              {...register("location")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="e.g. Little Rock, AR"
            />
          </div>

          <div>
            <label
              htmlFor="org-avatar-url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Avatar URL{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="org-avatar-url"
              {...register("avatarUrl")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="https://..."
            />
            {errors.avatarUrl && (
              <p className="text-red-500 text-sm mt-1">
                {errors.avatarUrl.message}
              </p>
            )}
          </div>

          <InviteEmailsField
            emails={inviteEmails}
            onEmailsChange={setInviteEmails}
          />

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating..." : "Create Organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
