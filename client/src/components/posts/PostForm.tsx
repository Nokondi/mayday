import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  createPostSchema,
  CATEGORIES,
  type CreatePostRequest,
} from "@mayday/shared";
import { ImagePlus, X, MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "../../hooks/useDebounce.js";
import { listMyOrganizations } from "../../api/organizations.js";
import { listMyCommunities } from "../../api/communities.js";
import { useAuth } from "../../context/AuthContext.js";
import { FormField } from "../common/FormField.js";

interface PostFormProps {
  onSubmit: (data: CreatePostRequest, images: File[]) => Promise<void>;
  isSubmitting: boolean;
}

export function PostForm({ onSubmit, isSubmitting }: PostFormProps) {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePostRequest>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      type: "REQUEST",
      urgency: "MEDIUM",
    },
  });

  const recurrenceFreq = watch("recurrenceFreq");

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [locationQuery, setLocationQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeoResult[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [resolvedLocation, setResolvedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);
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
    const remaining = 5 - images.length;
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
    if (!cleaned.communityId) cleaned.communityId = undefined;
    if (!cleaned.startAt) cleaned.startAt = undefined;
    if (!cleaned.endAt) cleaned.endAt = undefined;
    if (!cleaned.recurrenceFreq) {
      cleaned.recurrenceFreq = undefined;
      cleaned.recurrenceInterval = undefined;
    }
    return onSubmit(cleaned, images);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <fieldset className="border-0 p-0 m-0">
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Type
        </legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="REQUEST"
              {...register("type")}
              className="text-mayday-700"
            />
            <span>I need help (Request)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="OFFER"
              {...register("type")}
              className="text-mayday-700"
            />
            <span>I can help (Offer)</span>
          </label>
        </div>
      </fieldset>

      {myOrgs && myOrgs.length > 0 && (
        <div>
          <label
            htmlFor="post-organization"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Post as
          </label>
          <select
            id="post-organization"
            {...register("organizationId")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">{user?.name ?? "Yourself"}</option>
            {myOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {myCommunities && myCommunities.length > 0 && (
        <div>
          <label
            htmlFor="post-community"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Visibility
          </label>
          <select
            id="post-community"
            {...register("communityId")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Public (visible to everyone)</option>
            {myCommunities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} members only
              </option>
            ))}
          </select>
        </div>
      )}

      <FormField
        id="post-title"
        label="Title"
        error={errors.title?.message}
        placeholder="Brief description of what you need or can offer"
        {...register("title")}
      />

      <FormField
        multiline
        id="post-description"
        label="Description"
        error={errors.description?.message}
        rows={4}
        placeholder="Provide details about your request or offer..."
        {...register("description")}
      />

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Images{" "}
          <span className="text-gray-500 font-normal">
            (optional, maximum of 5 images, 5mb per image)
          </span>
        </label>

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {previews.map((src, i) => (
              <div
                key={i}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group"
              >
                <img
                  src={src}
                  alt={`Upload preview ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {images.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-mayday-400 hover:text-mayday-500 transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            Add images
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
            Category
          </label>
          <select
            id="post-category"
            aria-invalid={!!errors.category}
            aria-describedby={
              errors.category ? "post-category-error" : undefined
            }
            {...register("category")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Select a category</option>
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
            Urgency
          </label>
          <select
            id="post-urgency"
            {...register("urgency")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id="post-startAt"
          type="datetime-local"
          label="Starts"
          optional
          error={errors.startAt?.message}
          {...register("startAt")}
        />
        <FormField
          id="post-endAt"
          type="datetime-local"
          label="Ends"
          optional
          error={errors.endAt?.message}
          {...register("endAt")}
        />
      </div>

      <fieldset className="border-0 p-0 m-0">
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          Repeats <span className="text-gray-500 font-normal">(optional)</span>
        </legend>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">every</span>
          <input
            type="number"
            aria-label="Recurrence interval"
            min={1}
            max={365}
            {...register("recurrenceInterval")}
            disabled={!recurrenceFreq}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <select
            aria-label="Recurrence frequency"
            {...register("recurrenceFreq")}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Does not repeat</option>
            <option value="DAY">day(s)</option>
            <option value="WEEK">week(s)</option>
            <option value="MONTH">month(s)</option>
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
          Location <span className="text-gray-500 font-normal">(optional)</span>
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
              aria-label="Clear location"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="Search for an address or place..."
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
            aria-label="Location suggestions"
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
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
        {isSubmitting ? "Creating..." : "Create Post"}
      </button>
    </form>
  );
}
