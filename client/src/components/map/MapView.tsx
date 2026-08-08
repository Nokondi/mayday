import { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
// Side-effect import: loads the markercluster plugin's `L.MarkerCluster` type
// augmentation (the client tsconfig's `types` allowlist excludes it otherwise).
import 'leaflet.markercluster';
import { useIntl } from 'react-intl';
import type { PostWithAuthor } from '@mayday/shared';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default marker icons in Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/markers/marker-icon-2x.png',
  iconUrl: '/markers/marker-icon.png',
  shadowUrl: '/markers/marker-shadow.png',
});

const requestIcon = new L.Icon({
  iconUrl: '/markers/marker-icon-orange.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const offerIcon = new L.Icon({
  iconUrl: '/markers/marker-icon-green.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const eventIcon = new L.Icon({
  iconUrl: '/markers/marker-icon-violet.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const commsIcon = new L.Icon({
  iconUrl: '/markers/marker-icon-blue.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const iconsByType = {
  REQUEST: requestIcon,
  OFFER: offerIcon,
  EVENT: eventIcon,
  COMMS: commsIcon,
} as const;

// Round coordinates so a cluster's child markers can be matched back to the
// posts sharing that spot, immune to float-string drift through Leaflet.
const COORD_PRECISION = 6;
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORD_PRECISION)},${lng.toFixed(COORD_PRECISION)}`;
}

interface MapViewProps {
  posts: PostWithAuthor[];
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => void;
  /** Called with the posts at a clicked pin/cluster, or [] when the map is cleared. */
  onSelectPosts?: (posts: PostWithAuthor[]) => void;
  className?: string;
}

function MapCenterUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the first render — MapContainer already handles initial center/zoom
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

function MapEventHandler({
  onBoundsChange,
  onMapClick,
}: {
  onBoundsChange?: MapViewProps['onBoundsChange'];
  onMapClick?: () => void;
}) {
  useMapEvents({
    moveend: (e) => {
      if (!onBoundsChange) return;
      const bounds = e.target.getBounds();
      onBoundsChange({
        neLat: bounds.getNorthEast().lat,
        neLng: bounds.getNorthEast().lng,
        swLat: bounds.getSouthWest().lat,
        swLng: bounds.getSouthWest().lng,
      });
    },
    // A click on empty map (not on a marker/cluster, which stop propagation)
    // clears the current selection.
    click: () => onMapClick?.(),
  });
  return null;
}

function ClusteredMarkers({
  posts,
  onSelectPosts,
}: {
  posts: PostWithAuthor[];
  onSelectPosts: (posts: PostWithAuthor[]) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup>(null);

  const located = useMemo(
    () => posts.filter((p) => p.latitude != null && p.longitude != null),
    [posts],
  );

  // Index posts by quantized coordinate so a cluster's child markers resolve
  // back to every post sharing that exact spot.
  const positionIndex = useMemo(() => {
    const index = new Map<string, PostWithAuthor[]>();
    for (const post of located) {
      const key = coordKey(post.latitude!, post.longitude!);
      const bucket = index.get(key);
      if (bucket) bucket.push(post);
      else index.set(key, [post]);
    }
    return index;
  }, [located]);

  const handleClusterClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      // Also bound to clusterkeypress for keyboard users — only act on Enter.
      if (e.type === 'clusterkeypress') {
        const key = (e.originalEvent as unknown as KeyboardEvent | undefined)?.key;
        if (key && key !== 'Enter') return;
      }
      const cluster = (e.propagatedFrom ?? e.layer) as L.MarkerCluster;
      const bounds = cluster.getBounds();
      // Can't be split apart: all children share one point, or we're maxed out.
      const coLocated = bounds.getNorthEast().equals(bounds.getSouthWest());
      const atMaxZoom = map.getZoom() >= map.getMaxZoom();

      if (coLocated || atMaxZoom) {
        const keys = new Set(
          cluster.getAllChildMarkers().map((m) => {
            const { lat, lng } = m.getLatLng();
            return coordKey(lat, lng);
          }),
        );
        const selected = [...keys].flatMap((key) => positionIndex.get(key) ?? []);
        onSelectPosts(selected);
      } else {
        // Replicate the default zoom-to-bounds we disabled below.
        cluster.zoomToBounds();
      }
    },
    [map, positionIndex, onSelectPosts],
  );

  // The cluster group's typed props only expose mouse events, so bind keyboard
  // activation (Enter on a focused cluster) through the layer directly.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const handler = handleClusterClick as L.LeafletEventHandlerFn;
    group.on('clusterkeypress', handler);
    return () => {
      group.off('clusterkeypress', handler);
    };
  }, [handleClusterClick]);

  return (
    <MarkerClusterGroup
      ref={groupRef}
      zoomToBoundsOnClick={false}
      spiderfyOnMaxZoom={false}
      onClick={handleClusterClick}
    >
      {located.map((post) => (
        <Marker
          key={post.id}
          position={[post.latitude!, post.longitude!]}
          icon={iconsByType[post.type]}
          eventHandlers={{ click: () => onSelectPosts([post]) }}
        />
      ))}
    </MarkerClusterGroup>
  );
}

export function MapView({
  posts,
  center = [34.7465, -92.2896],
  zoom = 12,
  onBoundsChange,
  onSelectPosts = () => {},
  className = 'h-[600px]',
}: MapViewProps) {
  const intl = useIntl();
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      aria-label={intl.formatMessage({
        id: 'map.view.containerAriaLabel',
        defaultMessage: 'Map of mutual aid posts',
      })}
      className={`w-full rounded-lg ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterUpdater center={center} zoom={zoom} />
      <MapEventHandler onBoundsChange={onBoundsChange} onMapClick={() => onSelectPosts([])} />
      <ClusteredMarkers posts={posts} onSelectPosts={onSelectPosts} />
    </MapContainer>
  );
}
