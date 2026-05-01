import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createCommunitySchema,
  type CreateCommunityRequest,
} from "@mayday/shared";
import { createCommunity, inviteToCommunity } from "../api/communities.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";

export function CreateCommunityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCommunityRequest>({
    resolver: zodResolver(createCommunitySchema),
  });

  const mutation = useMutation({
    mutationFn: createCommunity,
    onSuccess: async (c) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });

      const emails = Array.from(
        new Set(inviteEmails.map((e) => e.trim()).filter(Boolean)),
      );
      if (emails.length > 0) {
        const results = await Promise.allSettled(
          emails.map((email) => inviteToCommunity(c.id, { email })),
        );
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const failed = emails.length - ok;
        if (ok && !failed) {
          toast.success(
            `Community created · ${ok} invite${ok === 1 ? "" : "s"} sent`,
          );
        } else if (ok && failed) {
          toast.success(`Community created · ${ok} invited, ${failed} failed`);
        } else {
          toast.success("Community created · invites failed to send");
        }
      } else {
        toast.success("Community created");
      }
      navigate(`/communities/${c.id}`);
    },
    onError: () => toast.error("Failed to create community"),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create a Community
      </h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form
          onSubmit={handleSubmit((data) => {
            const clean: CreateCommunityRequest = { name: data.name };
            if (data.description) clean.description = data.description;
            if (data.location) clean.location = data.location;
            if (data.avatarUrl) clean.avatarUrl = data.avatarUrl;
            mutation.mutate(clean);
          })}
          className="space-y-6"
        >
          <div>
            <label
              htmlFor="community-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="community-name"
              {...register("name")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="e.g. Little Rock Mutual Aid"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="community-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="community-description"
              {...register("description")}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="What is this community about?"
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="community-location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              id="community-location"
              {...register("location")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="e.g. Little Rock, AR"
            />
          </div>

          <div>
            <label
              htmlFor="community-avatar-url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Avatar URL{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="community-avatar-url"
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
            {mutation.isPending ? "Creating..." : "Create Community"}
          </button>
        </form>
      </div>
    </div>
  );
}
