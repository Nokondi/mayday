import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPosts } from '../api/posts.js';
import { listMyCommunities } from '../api/communities.js';
import { MapView } from '../components/map/MapView.js';
import { PostFilters } from '../components/posts/PostFilters.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useGeolocation } from '../hooks/useGeolocation.js';

export function MapPage() {
  const [searchParams] = useSearchParams();
  const geo = useGeolocation();
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [community, setCommunity] = useState('');
  const [bounds, setBounds] = useState<{ neLat: number; neLng: number; swLat: number; swLng: number } | null>(null);

  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities'],
    queryFn: listMyCommunities,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'map', { type, category, urgency, community, bounds }],
    queryFn: () => getPosts({
      type: type as any || undefined,
      category: category || undefined,
      urgency: urgency as any || undefined,
      communityId: community || undefined,
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

  // URL params take priority (from location links), then geolocation, then default
  const paramLat = searchParams.get('lat');
  const paramLng = searchParams.get('lng');
  const paramZoom = searchParams.get('zoom');

  const center = useMemo<[number, number]>(() => {
    if (paramLat && paramLng) return [parseFloat(paramLat), parseFloat(paramLng)];
    if (geo.latitude && geo.longitude) return [geo.latitude, geo.longitude];
    return [34.7465, -92.2896];
  }, [paramLat, paramLng, geo.latitude, geo.longitude]);

  const initialZoom = paramZoom ? parseInt(paramZoom) : 13;

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
        <PostFilters
          type={type} category={category} urgency={urgency}
          community={community} communities={myCommunities}
          onTypeChange={setType} onCategoryChange={setCategory}
          onUrgencyChange={setUrgency} onCommunityChange={setCommunity}
        />
        {data && (
          <p className="text-xs text-gray-500 mt-2">{data.total} posts in view</p>
        )}
      </div>
      {(isLoading && !data) || geo.loading ? (
        <LoadingSpinner className="h-full" />
      ) : (
        <MapView
          posts={data?.data || []}
          center={center}
          zoom={initialZoom}
          onBoundsChange={handleBoundsChange}
          className="h-full rounded-none"
        />
      )}
    </div>
  );
}
