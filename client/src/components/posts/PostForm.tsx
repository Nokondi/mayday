import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  createPostSchema,
  CATEGORIES,
  type CreatePostRequest,
  type PostWithAuthor,
} from "@mayday/shared";
import { ImagePlus, X, MapPin, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import { useDebounce } from "../../hooks/useDebounce.js";
import { listMyOrganizations } from "../../api/organizations.js";
import { listMyCommunities } from "../../api/communities.js";
import { useAuth } from "../../context/AuthContext.js";
import { FormField } from "../common/FormField.js";

interface PostFormProps {
  onSubmit: (
    data: CreatePostRequest,
    images: File[],
    removeImageIds: string[],
  ) => Promise<void>;
  isSubmitting: boolean;
  /** When provided, the form edits this post instead of creating a new one. */
  initialPost?: PostWithAuthor;
}

/** Format an ISO timestamp for a `datetime-local` input, or undefined. */
function toDateTimeLocal(iso: string | null | undefined): string | undefined {
  return iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : undefined;
}

export function PostForm({
  onSubmit,
  isSubmitting,
  initialPost,
}: PostFormProps) {
  const intl = useIntl();
  const { user } = useAuth();
  const isEdit = !!initialPost;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePostRequest>({
    resolver: zodResolver(createPostSchema),
    defaultValues: initialPost
      ? {
          type: initialPost.type,
          title: initialPost.title,
          description: initialPost.description,
          category: initialPost.category,
          urgency: initialPost.urgency,
          location: initialPost.location ?? undefined,
          latitude: initialPost.latitude ?? undefined,
          longitude: initialPost.longitude ?? undefined,
          startAt: toDateTimeLocal(initialPost.startAt),
          endAt: toDateTimeLocal(initialPost.endAt),
          recurrenceFreq: initialPost.recurrenceFreq ?? undefined,
          recurrenceInterval: initialPost.recurrenceInterval ?? undefined,
        }
      : {
          type: "REQUEST",
          urgency: "MEDIUM",
          sharedWithFriends: false,
        },
  });

  const recurrenceFreq = watch("recurrenceFreq");
  const sharedWithFriends = watch("sharedWithFriends") ?? false;
  const selectedCommunityIds = watch("communityIds") ?? [];

  // Organizations the user can post on behalf of
  const { data: myOrgs } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: listMyOrganizations,
  });

  // Communities the user can scope posts to
  const { data: myCommunities } = useQuery({
    queryKey: ["my-communities"],
    queryFn: listMyCommunities,
  });

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // Images already attached to the post (edit mode). Removing one here queues
  // its id for deletion on save; new uploads in `images` are appended.
  const [existingImages, setExistingImages] = useState<
    { id: string; url: string }[]
  >(initialPost?.images ?? []);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const totalImageCount = existingImages.length + images.length;

  // Geocoding state
  interface GeoResult {
    display_name: string;
    lat: string;
    lon: string;
    address?: {
      house_number?: string;
      road?: string;
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      state?: string;
      postcode?: string;
    };
    formatted?: string;
  }
  const hasInitialLocation =
    !!initialPost?.location &&
    initialPost.latitude != null &&
    initialPost.longitude != null;
  const [locationQuery, setLocationQuery] = useState(
    initialPost?.location ?? "",
  );
  const [geocodeResults, setGeocodeResults] = useState<GeoResult[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [resolvedLocation, setResolvedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(
    hasInitialLocation
      ? {
          name: initialPost!.location!,
          lat: initialPost!.latitude!,
          lng: initialPost!.longitude!,
        }
      : null,
  );
  const debouncedLocation = useDebounce(locationQuery, 500);

  function formatAddress(result: GeoResult): string {
    const a = result.address;
    if (!a) return result.display_name;

    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.hamlet || "";
    const state = a.state || "";
    const zip = a.postcode || "";

    // Build "street, city, state zip"
    const parts: string[] = [];
    if (street) parts.push(street);
    if (city) parts.push(city);
    if (state || zip) parts.push([state, zip].filter(Boolean).join(" "));

    return parts.length > 0 ? parts.join(", ") : result.display_name;
  }

  // Geocode when debounced query changes
  const lastGeocodedRef = useRef("");
  if (
    debouncedLocation.length >= 3 &&
    debouncedLocation !== lastGeocodedRef.current &&
    !resolvedLocation
  ) {
    lastGeocodedRef.current = debouncedLocation;
    setIsGeocoding(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(debouncedLocation)}&limit=5`,
      {
        headers: { "User-Agent": "MayDay-MutualAid/0.1" },
      },
    )
      .then((r) => r.json())
      .then((data: GeoResult[]) => {
        // Pre-compute formatted addresses
        setGeocodeResults(
          data.map((r) => ({ ...r, formatted: formatAddress(r) })),
        );
      })
      .catch(() => setGeocodeResults([]))
      .finally(() => setIsGeocoding(false));
  }

  const selectLocation = useCallback((result: GeoResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const name = result.formatted || formatAddress(result);
    setResolvedLocation({ name, lat, lng });
    setLocationQuery(name);
    setGeocodeResults([]);
    setActiveOptionIndex(-1);
    setValue("location", name);
    setValue("latitude", lat);
    setValue("longitude", lng);
  }, []);

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (geocodeResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveOptionIndex((i) => (i + 1) % geocodeResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveOptionIndex((i) => (i <= 0 ? geocodeResults.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeOptionIndex >= 0) {
      e.preventDefault();
      selectLocation(geocodeResults[activeOptionIndex]);
    } else if (e.key === "Escape") {
      setGeocodeResults([]);
      setActiveOptionIndex(-1);
    }
  };

  const clearLocation = useCallback(() => {
    setResolvedLocation(null);
    setLocationQuery("");
    setGeocodeResults([]);
    setActiveOptionIndex(-1);
    lastGeocodedRef.current = "";
    setValue("location", undefined as any);
    setValue("latitude", undefined as any);
    setValue("longitude", undefined as any);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - totalImageCount;
    const toAdd = files.slice(0, remaining);

    setImages((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [
      ...prev,
      ...toAdd.map((f) => URL.createObjectURL(f)),
    ]);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (data: CreatePostRequest) => {
    const cleaned: CreatePostRequest = { ...data };
    // Selects/inputs use '' for "none" — convert to undefined
    if (!cleaned.organizationId) cleaned.organizationId = undefined;
    if (!cleaned.communityIds?.length) cleaned.communityIds = undefined;
    if (!cleaned.startAt) cleaned.startAt = undefined;
    if (!cleaned.endAt) cleaned.endAt = undefined;
    if (!cleaned.recurrenceFreq) {
      cleaned.recurrenceFreq = undefined;
      cleaned.recurrenceInterval = undefined;
    }
    return onSubmit(cleaned, images, removedImageIds);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div>
        <label
          htmlFor="post-type"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          <FormattedMessage id="posts.form.typeLegend" defaultMessage="Type" />
        </label>
        <select
          id="post-type"
          {...register("type")}
          className="w-full border border-mayday-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="REQUEST">
            {intl.formatMessage({
              id: "posts.form.requestRadioLabel",
              defaultMessage: "I need help (Request)",
            })}
          </option>
          <option value="OFFER">
            {intl.formatMessage({
              id: "posts.form.offerRadioLabel",
              defaultMessage: "I can help (Offer)",
            })}
          </option>
          <option value="EVENT">
            {intl.formatMessage({
              id: "posts.form.eventRadioLabel",
              defaultMessage: "I'm organizing (Event)",
            })}
          </option>
        </select>
      </div>

      {!isEdit && myOrgs && myOrgs.length > 0 && (
        <div>
          <label
            htmlFor="post-organization"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            <FormattedMessage
              id="posts.form.postAsLabel"
              defaultMessage="Post as"
            />
          </label>
          <select
            id="post-organization"
            {...register("organizationId")}
            className="w-full border border-mayday-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">
              {user?.name ??
                intl.formatMessage({
                  id: "posts.form.postAsYourselfDefault",
                  defaultMessage: "Yourself",
                })}
            </option>
            {myOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isEdit && (() => {
        const communities = myCommunities ?? [];
        const selectedCommunities = communities.filter((c) =>
          selectedCommunityIds.includes(c.id),
        );
        const availableCommunities = communities.filter(
          (c) => !selectedCommunityIds.includes(c.id),
        );
        // The dropdown offers a synthetic "Friends" entry alongside the user's
        // communities; picking any combination unions the audience. Nothing
        // selected ⇒ public.
        const friendsLabel = intl.formatMessage({
          id: "posts.form.friendsOption",
          defaultMessage: "Friends",
        });
        const hasSelection = sharedWithFriends || selectedCommunities.length > 0;
        // Disabled only when there's nothing left to add: friends already chosen
        // and no remaining communities.
        const dropdownDisabled =
          sharedWithFriends && availableCommunities.length === 0;
        return (
          <div>
            <label
              htmlFor="post-community"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              <FormattedMessage
                id="posts.form.visibilityLabel"
                defaultMessage="Visibility"
              />
            </label>
            {hasSelection && (
              <ul className="flex flex-wrap gap-2 mb-2">
                {sharedWithFriends && (
                  <li>
                    <span className="inline-flex items-center gap-1 text-sm bg-mayday-100 text-mayday-800 rounded-full pl-3 pr-1 py-1">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {friendsLabel}
                      <button
                        type="button"
                        onClick={() => setValue("sharedWithFriends", false)}
                        aria-label={intl.formatMessage(
                          {
                            id: "posts.form.removeAudienceAria",
                            defaultMessage: "Remove {name}",
                          },
                          { name: friendsLabel },
                        )}
                        className="text-mayday-600 hover:text-mayday-800 rounded-full p-0.5"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                )}
                {selectedCommunities.map((c) => (
                  <li key={c.id}>
                    <span className="inline-flex items-center gap-1 text-sm bg-mayday-100 text-mayday-800 rounded-full pl-3 pr-1 py-1">
                      {c.name}
                      <button
                        type="button"
                        onClick={() =>
                          setValue(
                            "communityIds",
                            selectedCommunityIds.filter((id) => id !== c.id),
                          )
                        }
                        aria-label={intl.formatMessage(
                          {
                            id: "posts.form.removeAudienceAria",
                            defaultMessage: "Remove {name}",
                          },
                          { name: c.name },
                        )}
                        className="text-mayday-600 hover:text-mayday-800 rounded-full p-0.5"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <select
              id="post-community"
              value=""
              disabled={dropdownDisabled}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (val === "__friends__") {
                  setValue("sharedWithFriends", true);
                } else {
                  setValue("communityIds", [...selectedCommunityIds, val]);
                }
              }}
              className="w-full border border-mayday-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">
                {intl.formatMessage({
                  id: "posts.form.addAudiencePlaceholder",
                  defaultMessage: "Add friends or a community…",
                })}
              </option>
              {!sharedWithFriends && (
                <option value="__friends__">{friendsLabel}</option>
              )}
              {availableCommunities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {hasSelection ? (
                <FormattedMessage
                  id="posts.form.visibilityRestrictedHint"
                  defaultMessage="Visible only to the friends and communities you select."
                />
              ) : (
                <FormattedMessage
                  id="posts.form.visibilityPublicHint"
                  defaultMessage="Public — visible to everyone."
                />
              )}
            </p>
          </div>
        );
      })()}

      <FormField
        id="post-title"
        label={intl.formatMessage({
          id: "posts.form.titleLabel",
          defaultMessage: "Title",
        })}
        error={errors.title?.message}
        placeholder={intl.formatMessage({
          id: "posts.form.titlePlaceholder",
          defaultMessage:
            "Brief description of what you need, can offer, or are organizing",
        })}
        {...register("title")}
      />

      <FormField
        multiline
        id="post-description"
        label={intl.formatMessage({
          id: "common.fields.description",
          defaultMessage: "Description",
        })}
        error={errors.description?.message}
        rows={4}
        placeholder={intl.formatMessage({
          id: "posts.form.descriptionPlaceholder",
          defaultMessage: "Provide details about your request, offer, or event...",
        })}
        {...register("description")}
      />

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FormattedMessage
            id="posts.form.imagesLabel"
            defaultMessage="Images"
          />
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between label and (optional) suffix */}
          {" "}
          <span className="text-gray-500 font-normal">
            <FormattedMessage
              id="posts.form.imagesHelperText"
              defaultMessage="(optional, maximum of 5 images, 5mb per image)"
            />
          </span>
        </label>

        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {existingImages.map((img, i) => (
              <div
                key={img.id}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-mayday-200 group"
              >
                <img
                  src={img.url}
                  alt={intl.formatMessage(
                    {
                      id: "posts.form.existingImageAlt",
                      defaultMessage: "Current image {n}",
                    },
                    { n: i + 1 },
                  )}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(img.id)}
                  aria-label={intl.formatMessage(
                    {
                      id: "posts.form.removeImageAria",
                      defaultMessage: "Remove image {n}",
                    },
                    { n: i + 1 },
                  )}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {previews.map((src, i) => (
              <div
                key={i}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-mayday-200 group"
              >
                <img
                  src={src}
                  alt={intl.formatMessage(
                    {
                      id: "posts.form.imagePreviewAlt",
                      defaultMessage: "Upload preview {n}",
                    },
                    { n: i + 1 },
                  )}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={intl.formatMessage(
                    {
                      id: "posts.form.removeImageAria",
                      defaultMessage: "Remove image {n}",
                    },
                    { n: i + 1 },
                  )}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalImageCount < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-mayday-300 rounded-lg text-gray-500 hover:border-mayday-400 hover:text-mayday-500 transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <FormattedMessage
              id="posts.form.addImagesButton"
              defaultMessage="Add images"
            />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="post-category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            <FormattedMessage
              id="posts.form.categoryLabel"
              defaultMessage="Category"
            />
          </label>
          <select
            id="post-category"
            aria-invalid={!!errors.category}
            aria-describedby={
              errors.category ? "post-category-error" : undefined
            }
            {...register("category")}
            className="w-full border border-mayday-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">
              {intl.formatMessage({
                id: "posts.form.selectCategoryPlaceholder",
                defaultMessage: "Select a category",
              })}
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && (
            <p id="post-category-error" className="text-red-500 text-sm mt-1">
              {errors.category.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="post-urgency"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            <FormattedMessage
              id="posts.form.urgencyLabel"
              defaultMessage="Urgency"
            />
          </label>
          <select
            id="post-urgency"
            {...register("urgency")}
            className="w-full border border-mayday-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="LOW">
              {intl.formatMessage({ id: "urgency.low", defaultMessage: "Low" })}
            </option>
            <option value="MEDIUM">
              {intl.formatMessage({
                id: "urgency.medium",
                defaultMessage: "Medium",
              })}
            </option>
            <option value="HIGH">
              {intl.formatMessage({
                id: "urgency.high",
                defaultMessage: "High",
              })}
            </option>
            <option value="CRITICAL">
              {intl.formatMessage({
                id: "urgency.critical",
                defaultMessage: "Critical",
              })}
            </option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id="post-startAt"
          type="datetime-local"
          label={intl.formatMessage({
            id: "posts.form.startsLabel",
            defaultMessage: "Starts",
          })}
          optional
          error={errors.startAt?.message}
          {...register("startAt")}
        />
        <FormField
          id="post-endAt"
          type="datetime-local"
          label={intl.formatMessage({
            id: "posts.form.endsLabel",
            defaultMessage: "Ends",
          })}
          optional
          error={errors.endAt?.message}
          {...register("endAt")}
        />
      </div>

      <fieldset className="border-0 p-0 m-0">
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          <FormattedMessage
            id="posts.form.repeatsLegend"
            defaultMessage="Repeats"
          />
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between label and (optional) suffix */}
          {" "}
          <span className="text-gray-500 font-normal">
            <FormattedMessage
              id="common.formField.optionalSuffix"
              defaultMessage="(optional)"
            />
          </span>
        </legend>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            <FormattedMessage
              id="posts.form.repeatEvery"
              defaultMessage="every"
            />
          </span>
          <input
            type="number"
            aria-label={intl.formatMessage({
              id: "posts.form.recurrenceIntervalAria",
              defaultMessage: "Recurrence interval",
            })}
            min={1}
            max={365}
            {...register("recurrenceInterval")}
            disabled={!recurrenceFreq}
            className="w-20 border border-mayday-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <select
            aria-label={intl.formatMessage({
              id: "posts.form.recurrenceFrequencyAria",
              defaultMessage: "Recurrence frequency",
            })}
            {...register("recurrenceFreq")}
            className="border border-mayday-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">
              {intl.formatMessage({
                id: "posts.form.recurrenceNone",
                defaultMessage: "Does not repeat",
              })}
            </option>
            <option value="DAY">
              {intl.formatMessage({
                id: "posts.form.recurrenceDays",
                defaultMessage: "day(s)",
              })}
            </option>
            <option value="WEEK">
              {intl.formatMessage({
                id: "posts.form.recurrenceWeeks",
                defaultMessage: "week(s)",
              })}
            </option>
            <option value="MONTH">
              {intl.formatMessage({
                id: "posts.form.recurrenceMonths",
                defaultMessage: "month(s)",
              })}
            </option>
          </select>
        </div>
        {errors.recurrenceFreq && (
          <p className="text-red-500 text-sm mt-1">
            {errors.recurrenceFreq.message}
          </p>
        )}
        {errors.recurrenceInterval && (
          <p className="text-red-500 text-sm mt-1">
            {errors.recurrenceInterval.message}
          </p>
        )}
      </fieldset>

      <div className="relative">
        <label
          htmlFor="post-location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          <FormattedMessage
            id="common.fields.location"
            defaultMessage="Location"
          />
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between label and (optional) suffix */}
          {" "}
          <span className="text-gray-500 font-normal">
            <FormattedMessage
              id="common.formField.optionalSuffix"
              defaultMessage="(optional)"
            />
          </span>
        </label>
        {resolvedLocation ? (
          <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2">
            <MapPin
              className="w-4 h-4 text-green-600 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm text-green-800 flex-1">
              {resolvedLocation.name}
            </span>
            <button
              type="button"
              onClick={clearLocation}
              aria-label={intl.formatMessage({
                id: "posts.form.clearLocationAria",
                defaultMessage: "Clear location",
              })}
              className="text-gray-500 hover:text-gray-600"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              id="post-location"
              type="text"
              role="combobox"
              aria-expanded={geocodeResults.length > 0}
              aria-controls="post-location-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                activeOptionIndex >= 0
                  ? `post-location-option-${activeOptionIndex}`
                  : undefined
              }
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setResolvedLocation(null);
                setActiveOptionIndex(-1);
              }}
              onKeyDown={handleLocationKeyDown}
              className="w-full border border-mayday-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder={intl.formatMessage({
                id: "posts.form.locationPlaceholder",
                defaultMessage: "Search for an address or place...",
              })}
            />
            {isGeocoding && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {geocodeResults.length > 0 && !resolvedLocation && (
          <ul
            id="post-location-listbox"
            role="listbox"
            aria-label={intl.formatMessage({
              id: "posts.form.locationSuggestionsAria",
              defaultMessage: "Location suggestions",
            })}
            className="absolute z-10 w-full mt-1 bg-white border border-mayday-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {geocodeResults.map((result, i) => (
              <li
                key={i}
                id={`post-location-option-${i}`}
                role="option"
                aria-selected={i === activeOptionIndex}
              >
                <button
                  type="button"
                  onClick={() => selectLocation(result)}
                  onMouseEnter={() => setActiveOptionIndex(i)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 ${
                    i === activeOptionIndex ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <MapPin
                    className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="line-clamp-2">
                    {result.formatted || result.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-700 text-white py-3 rounded-lg font-medium hover:bg-mayday-800 disabled:opacity-50"
      >
        {isSubmitting ? (
          isEdit ? (
            <FormattedMessage
              id="posts.form.savingButton"
              defaultMessage="Saving..."
            />
          ) : (
            <FormattedMessage
              id="posts.form.submittingButton"
              defaultMessage="Creating..."
            />
          )
        ) : isEdit ? (
          <FormattedMessage
            id="posts.form.saveButton"
            defaultMessage="Save Changes"
          />
        ) : (
          <FormattedMessage
            id="posts.form.submitButton"
            defaultMessage="Create Post"
          />
        )}
      </button>
    </form>
  );
}
