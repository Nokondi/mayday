import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import {
  createOrganizationSchema,
  type CreateOrganizationRequest,
} from "@mayday/shared";
import {
  createOrganization,
  inviteToOrganization,
  uploadOrganizationAvatar,
} from "../api/organizations.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";
import { FormField } from "../components/common/FormField.js";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationRequest>({
    resolver: zodResolver(createOrganizationSchema),
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, GIF, and WebP images are allowed");
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error("Image must be 5MB or smaller");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const removeAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });

      if (avatarFile) {
        try {
          await uploadOrganizationAvatar(org.id, avatarFile);
        } catch {
          toast.error(
            "Avatar upload failed — you can try again from the manage page",
          );
        }
      }

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
            // Strip empty optional fields so length validators don't fire
            const clean: CreateOrganizationRequest = { name: data.name };
            if (data.description) clean.description = data.description;
            if (data.location) clean.location = data.location;
            mutation.mutate(clean);
          })}
          className="space-y-6"
        >
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Avatar{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </p>
            {avatarPreview ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  aria-label="Remove avatar"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-mayday-400 hover:text-mayday-500 transition-colors"
              >
                <ImagePlus className="w-5 h-5" aria-hidden="true" />
                Add avatar
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_ALLOWED_TYPES.join(",")}
              onChange={handleAvatarSelect}
              className="hidden"
            />
          </div>

          <FormField
            id="org-name"
            label="Name"
            error={errors.name?.message}
            placeholder="e.g. Riverside Mutual Aid"
            {...register("name")}
          />

          <FormField
            multiline
            id="org-description"
            label="Description"
            error={errors.description?.message}
            rows={4}
            placeholder="What does your organization do?"
            {...register("description")}
          />

          <FormField
            id="org-location"
            label="Location"
            placeholder="e.g. Little Rock, AR"
            {...register("location")}
          />

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
