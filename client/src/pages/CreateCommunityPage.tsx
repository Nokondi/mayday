import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import {
  createCommunitySchema,
  type CreateCommunityRequest,
} from "@mayday/shared";
import {
  createCommunity,
  inviteToCommunity,
  uploadCommunityAvatar,
} from "../api/communities.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function CreateCommunityPage() {
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
  } = useForm<CreateCommunityRequest>({
    resolver: zodResolver(createCommunitySchema),
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
    mutationFn: createCommunity,
    onSuccess: async (c) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["my-communities"] });

      if (avatarFile) {
        try {
          await uploadCommunityAvatar(c.id, avatarFile);
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
