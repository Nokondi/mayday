import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  createCommunitySchema,
  type CreateCommunityRequest,
  type ProfileLink,
} from "@mayday/shared";
import {
  createCommunity,
  inviteToCommunity,
  uploadCommunityAvatar,
} from "../api/communities.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";
import { FormField } from "../components/common/FormField.js";
import { LinksEditor, cleanLinks } from "../components/common/LinksEditor.js";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function CreateCommunityPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [links, setLinks] = useState<ProfileLink[]>([]);
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
      toast.error(
        intl.formatMessage({
          id: "common.avatarUploader.invalidTypeError",
          defaultMessage: "Only JPEG, PNG, GIF, and WebP images are allowed",
        }),
      );
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error(
        intl.formatMessage({
          id: "common.avatarUploader.fileTooLargeError",
          defaultMessage: "Image must be 5MB or smaller",
        }),
      );
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
            intl.formatMessage({
              id: "groups.create.avatarUploadFailedToast",
              defaultMessage:
                "Avatar upload failed — you can try again from the manage page",
            }),
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
            intl.formatMessage(
              {
                id: "groups.create.successWithInvitesSentToast",
                defaultMessage:
                  "{kind, select, organization {Organization} community {Community} other {Group}} created · {count, plural, one {# invite} other {# invites}} sent",
              },
              { kind: "community", count: ok },
            ),
          );
        } else if (ok && failed) {
          toast.success(
            intl.formatMessage(
              {
                id: "groups.create.successWithPartialFailuresToast",
                defaultMessage:
                  "{kind, select, organization {Organization} community {Community} other {Group}} created · {ok} invited, {failed} failed",
              },
              { kind: "community", ok, failed },
            ),
          );
        } else {
          toast.success(
            intl.formatMessage(
              {
                id: "groups.create.successAllInvitesFailedToast",
                defaultMessage:
                  "{kind, select, organization {Organization} community {Community} other {Group}} created · invites failed to send",
              },
              { kind: "community" },
            ),
          );
        }
      } else {
        toast.success(
          intl.formatMessage(
            {
              id: "groups.create.successToast",
              defaultMessage:
                "{kind, select, organization {Organization} community {Community} other {Group}} created",
            },
            { kind: "community" },
          ),
        );
      }
      navigate(`/communities/${c.id}`);
    },
    onError: () =>
      toast.error(
        intl.formatMessage(
          {
            id: "groups.create.failureToast",
            defaultMessage:
              "Failed to create {kind, select, organization {organization} community {community} other {group}}",
          },
          { kind: "community" },
        ),
      ),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        <FormattedMessage
          id="communities.createPage.title"
          defaultMessage="Create a Community"
        />
      </h1>
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <form
          onSubmit={handleSubmit((data) => {
            const clean: CreateCommunityRequest = { name: data.name };
            if (data.description) clean.description = data.description;
            if (data.location) clean.location = data.location;
            const cleanedLinks = cleanLinks(links);
            if (cleanedLinks) clean.links = cleanedLinks;
            mutation.mutate(clean);
          })}
          className="space-y-6"
        >
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              <FormattedMessage
                id="common.fields.avatar"
                defaultMessage="Avatar"
              />
              {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between label and (optional) suffix */}
              {" "}
              <span className="text-gray-500 font-normal">
                <FormattedMessage
                  id="common.formField.optionalSuffix"
                  defaultMessage="(optional)"
                />
              </span>
            </p>
            {avatarPreview ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-mayday-200 group">
                <img
                  src={avatarPreview}
                  alt={intl.formatMessage({
                    id: "groups.create.avatarPreviewAlt",
                    defaultMessage: "Avatar preview",
                  })}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  aria-label={intl.formatMessage({
                    id: "groups.create.removeAvatarAria",
                    defaultMessage: "Remove avatar",
                  })}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-mayday-300 rounded-lg text-gray-500 hover:border-mayday-400 hover:text-mayday-500 transition-colors"
              >
                <ImagePlus className="w-5 h-5" aria-hidden="true" />
                <FormattedMessage
                  id="groups.create.addAvatarButton"
                  defaultMessage="Add avatar"
                />
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
            id="community-name"
            label={intl.formatMessage({
              id: "common.fields.name",
              defaultMessage: "Name",
            })}
            error={errors.name?.message}
            placeholder={intl.formatMessage({
              id: "communities.createPage.namePlaceholder",
              defaultMessage: "e.g. Little Rock Mutual Aid",
            })}
            {...register("name")}
          />

          <FormField
            multiline
            id="community-description"
            label={intl.formatMessage({
              id: "common.fields.description",
              defaultMessage: "Description",
            })}
            error={errors.description?.message}
            rows={4}
            placeholder={intl.formatMessage({
              id: "communities.createPage.descriptionPlaceholder",
              defaultMessage: "What is this community about?",
            })}
            {...register("description")}
          />

          <FormField
            id="community-location"
            label={intl.formatMessage({
              id: "common.fields.location",
              defaultMessage: "Location",
            })}
            placeholder={intl.formatMessage({
              id: "groups.create.locationPlaceholder",
              defaultMessage: "e.g. Little Rock, AR",
            })}
            {...register("location")}
            optional
          />

          <LinksEditor
            value={links}
            onChange={setLinks}
            idPrefix="community-link"
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
            {mutation.isPending ? (
              <FormattedMessage
                id="groups.create.submittingButton"
                defaultMessage="Creating..."
              />
            ) : (
              <FormattedMessage
                id="communities.createPage.submitButton"
                defaultMessage="Create Community"
              />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
