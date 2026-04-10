import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { PostWithAuthor } from '@mayday/shared';
import { PostCard } from '../posts/PostCard.js';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons in Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const requestIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const offerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapViewProps {
  posts: PostWithAuthor[];
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => void;
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

function MapEventHandler({ onBoundsChange }: { onBoundsChange?: MapViewProps['onBoundsChange'] }) {
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
  });
  return null;
}

export function MapView({ posts, center = [40.7128, -74.006], zoom = 12, onBoundsChange, className = 'h-[600px]' }: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} className={`w-full rounded-lg ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenterUpdater center={center} zoom={zoom} />
      <MapEventHandler onBoundsChange={onBoundsChange} />
      {posts.filter(p => p.latitude && p.longitude).map((post) => (
        <Marker
          key={post.id}
          position={[post.latitude!, post.longitude!]}
          icon={post.type === 'REQUEST' ? requestIcon : offerIcon}
        >
          <Popup maxWidth={300}>
            <div className="min-w-[250px]">
              <PostCard post={post} />
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
