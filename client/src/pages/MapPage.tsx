import { useState, useCallback, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPosts } from '../api/posts.js';
import { MapView } from '../components/map/MapView.js';
import { PostFilters } from '../components/posts/PostFilters.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useGeolocation } from '../hooks/useGeolocation.js';

export function MapPage() {
  const geo = useGeolocation();
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [bounds, setBounds] = useState<{ neLat: number; neLng: number; swLat: number; swLng: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'map', { type, category, urgency, bounds }],
    queryFn: () => getPosts({
      type: type as any || undefined,
      category: category || undefined,
      urgency: urgency as any || undefined,
      status: 'OPEN',
      limit: 100,
      ...(bounds || {}),
    }),
    // Keep showing previous data while fetching new bounds — prevents map unmount/remount
    placeholderData: keepPreviousData,
  });

  const handleBoundsChange = useCallback((newBounds: typeof bounds) => {
    setBounds(newBounds);
  }, []);

  const center = useMemo<[number, number]>(() =>
    geo.latitude && geo.longitude
      ? [geo.latitude, geo.longitude]
      : [40.7128, -74.006],
    [geo.latitude, geo.longitude],
  );

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
        <PostFilters
          type={type} category={category} urgency={urgency} sort="recent"
          onTypeChange={setType} onCategoryChange={setCategory}
          onUrgencyChange={setUrgency} onSortChange={() => {}}
        />
        {data && (
          <p className="text-xs text-gray-500 mt-2">{data.total} posts in view</p>
        )}
      </div>
      {isLoading && !data ? (
        <LoadingSpinner className="h-full" />
      ) : (
        <MapView
          posts={data?.data || []}
          center={center}
          zoom={13}
          onBoundsChange={handleBoundsChange}
          className="h-full rounded-none"
        />
      )}
    </div>
  );
}
