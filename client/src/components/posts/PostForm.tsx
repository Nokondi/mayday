import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { createPostSchema, CATEGORIES, type CreatePostRequest } from '@mayday/shared';
import { ImagePlus, X, MapPin, Loader2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce.js';
import { listMyOrganizations } from '../../api/organizations.js';
import { listMyCommunities } from '../../api/communities.js';
import { useAuth } from '../../context/AuthContext.js';

interface PostFormProps {
  onSubmit: (data: CreatePostRequest, images: File[]) => Promise<void>;
  isSubmitting: boolean;
}

export function PostForm({ onSubmit, isSubmitting }: PostFormProps) {
  const { user } = useAuth();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreatePostRequest>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      type: 'REQUEST',
      urgency: 'MEDIUM',
    },
  });

  // Organizations the user can post on behalf of
  const { data: myOrgs } = useQuery({
    queryKey: ['my-organizations'],
    queryFn: listMyOrganizations,
  });

  // Communities the user can scope posts to
  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities'],
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
  const [locationQuery, setLocationQuery] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<GeoResult[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const debouncedLocation = useDebounce(locationQuery, 500);

  function formatAddress(result: GeoResult): string {
    const a = result.address;
    if (!a) return result.display_name;

    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || a.hamlet || '';
    const state = a.state || '';
    const zip = a.postcode || '';

    // Build "street, city, state zip"
    const parts: string[] = [];
    if (street) parts.push(street);
    if (city) parts.push(city);
    if (state || zip) parts.push([state, zip].filter(Boolean).join(' '));

    return parts.length > 0 ? parts.join(', ') : result.display_name;
  }

  // Geocode when debounced query changes
  const lastGeocodedRef = useRef('');
  if (debouncedLocation.length >= 3 && debouncedLocation !== lastGeocodedRef.current && !resolvedLocation) {
    lastGeocodedRef.current = debouncedLocation;
    setIsGeocoding(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(debouncedLocation)}&limit=5`, {
      headers: { 'User-Agent': 'MayDay-MutualAid/0.1' },
    })
      .then(r => r.json())
      .then((data: GeoResult[]) => {
        // Pre-compute formatted addresses
        setGeocodeResults(data.map(r => ({ ...r, formatted: formatAddress(r) })));
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
    setValue('location', name);
    setValue('latitude', lat);
    setValue('longitude', lng);
  }, []);

  const clearLocation = useCallback(() => {
    setResolvedLocation(null);
    setLocationQuery('');
    setGeocodeResults([]);
    lastGeocodedRef.current = '';
    setValue('location', undefined as any);
    setValue('latitude', undefined as any);
    setValue('longitude', undefined as any);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - images.length;
    const toAdd = files.slice(0, remaining);

    setImages(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (data: CreatePostRequest) => {
    const cleaned: CreatePostRequest = { ...data };
    // Selects/inputs use '' for "none" — convert to undefined
    if (!cleaned.organizationId) cleaned.organizationId = undefined;
    if (!cleaned.communityId) cleaned.communityId = undefined;
    if (!cleaned.startAt) cleaned.startAt = undefined;
    if (!cleaned.endAt) cleaned.endAt = undefined;
    return onSubmit(cleaned, images);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" value="REQUEST" {...register('type')} className="text-mayday-500" />
            <span>I need help (Request)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="OFFER" {...register('type')} className="text-green-500" />
            <span>I can help (Offer)</span>
          </label>
        </div>
      </div>

      {myOrgs && myOrgs.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Post as</label>
          <select
            {...register('organizationId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">{user?.name ?? 'Yourself'}</option>
            {myOrgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      {myCommunities && myCommunities.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select
            {...register('communityId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Public (visible to everyone)</option>
            {myCommunities.map((c) => (
              <option key={c.id} value={c.id}>{c.name} members only</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          {...register('title')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="Brief description of what you need or can offer"
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          placeholder="Provide details about your request or offer..."
        />
        {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Images <span className="text-gray-400 font-normal">(optional, up to 5)</span>
        </label>

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {previews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group">
                <img src={src} alt={`Preview of image ${i + 1}`} className="w-full h-full object-cover" />
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            {...register('category')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
          <select
            {...register('urgency')}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Starts <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="datetime-local"
            {...register('startAt')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          />
          {errors.startAt && <p className="text-red-500 text-sm mt-1">{errors.startAt.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ends <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="datetime-local"
            {...register('endAt')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
          />
          {errors.endAt && <p className="text-red-500 text-sm mt-1">{errors.endAt.message}</p>}
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        {resolvedLocation ? (
          <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm text-green-800 flex-1">{resolvedLocation.name}</span>
            <button type="button" onClick={clearLocation} aria-label="Clear location" className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setResolvedLocation(null);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              placeholder="Search for an address or place..."
            />
            {isGeocoding && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
        )}

        {geocodeResults.length > 0 && !resolvedLocation && (
          <ul role="listbox" aria-label="Location suggestions" className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {geocodeResults.map((result, i) => (
              <li key={i} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => selectLocation(result)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span className="line-clamp-2">{result.formatted || result.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-mayday-500 text-white py-3 rounded-lg font-medium hover:bg-mayday-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
