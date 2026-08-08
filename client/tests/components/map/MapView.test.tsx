import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';

/**
 * react-leaflet (and the markercluster plugin) render a real Leaflet map, which
 * depends on DOM APIs jsdom does not implement. For a unit test we only care
 * that MapView forwards the right props, emits one Marker per geolocated post
 * with the correct icon, and routes pin/cluster/empty-map clicks to
 * `onSelectPosts`. Thin stubs capture those decisions as plain DOM + spies.
 */
const mapStub = {
  setView: vi.fn(),
  getZoom: vi.fn(() => 12),
  getMaxZoom: vi.fn(() => 18),
};

// Handlers MapView registers via useMapEvents (moveend, click).
const capturedMapEvents: Record<string, (e: unknown) => void> = {};
// Cluster-group handlers MapView passes (onClick → clusterclick, onKeypress).
const capturedClusterHandlers: {
  onClick?: (e: unknown) => void;
  onKeypress?: (e: unknown) => void;
} = {};

vi.mock('react-leaflet', () => {
  const MapContainer = ({ children, ...props }: Record<string, unknown>) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify((props as { center: unknown }).center)}
      data-zoom={String((props as { zoom: unknown }).zoom)}
      className={(props as { className?: string }).className}
    >
      {children as React.ReactNode}
    </div>
  );

  const TileLayer = (props: Record<string, unknown>) => (
    <div
      data-testid="tile-layer"
      data-url={String((props as { url: unknown }).url)}
      data-attribution={String((props as { attribution: unknown }).attribution)}
    />
  );

  const Marker = ({
    position,
    icon,
    eventHandlers,
  }: Record<string, unknown> & {
    eventHandlers?: { click?: () => void };
  }) => {
    const typedIcon = icon as { options?: { iconUrl?: string } } | undefined;
    return (
      <button
        type="button"
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-icon={typedIcon?.options?.iconUrl ?? ''}
        onClick={() => eventHandlers?.click?.()}
      />
    );
  };

  const useMapEvents = (handlers: Record<string, (e: unknown) => void>) => {
    Object.assign(capturedMapEvents, handlers);
    return null;
  };

  return {
    MapContainer,
    TileLayer,
    Marker,
    useMap: () => mapStub,
    useMapEvents,
  };
});

vi.mock('react-leaflet-cluster', async () => {
  const React = await import('react');
  // Fake L.MarkerClusterGroup: MapView binds 'clusterkeypress' via the ref.
  const fakeGroup = {
    on: (event: string, cb: (e: unknown) => void) => {
      if (event === 'clusterkeypress') capturedClusterHandlers.onKeypress = cb;
    },
    off: () => {},
  };
  const MarkerClusterGroup = React.forwardRef(
    (
      { children, onClick }: { children?: React.ReactNode; onClick?: (e: unknown) => void },
      ref: React.Ref<unknown>,
    ) => {
      capturedClusterHandlers.onClick = onClick;
      React.useImperativeHandle(ref, () => fakeGroup, []);
      return <div data-testid="cluster-group">{children}</div>;
    },
  );
  return { default: MarkerClusterGroup };
});

// The plugin's runtime is unused here (the cluster group is stubbed above); we
// only need its type augmentation, so stub the module to a no-op.
vi.mock('leaflet.markercluster', () => ({}));

// Avoid CSS import errors in jsdom.
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

import { MapView } from '../../../src/components/map/MapView.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    sharedWithFriends: false,
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: 'Somewhere',
    latitude: 34.7,
    longitude: -92.3,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    commentCount: 0,
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      links: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    communities: [],
    ...overrides,
  };
}

// Build a fake LatLng with the `.equals` Leaflet exposes.
function latLng(lat: number, lng: number) {
  return { lat, lng, equals: (o: { lat: number; lng: number }) => o.lat === lat && o.lng === lng };
}

// Build a fake L.MarkerCluster for a set of child coordinates.
function fakeCluster(coords: Array<[number, number]>) {
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const sw = latLng(Math.min(...lats), Math.min(...lngs));
  const ne = latLng(Math.max(...lats), Math.max(...lngs));
  return {
    getBounds: () => ({ getNorthEast: () => ne, getSouthWest: () => sw }),
    getAllChildMarkers: () => coords.map(([lat, lng]) => ({ getLatLng: () => latLng(lat, lng) })),
    zoomToBounds: vi.fn(),
  };
}

function renderMap(props: Partial<Parameters<typeof MapView>[0]> = {}) {
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <MemoryRouter>
        <MapView posts={[]} {...props} />
      </MemoryRouter>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete capturedMapEvents.moveend;
  delete capturedMapEvents.click;
  capturedClusterHandlers.onClick = undefined;
  capturedClusterHandlers.onKeypress = undefined;
  mapStub.getZoom.mockReturnValue(12);
  mapStub.getMaxZoom.mockReturnValue(18);
});

describe('MapView — container', () => {
  it('renders a MapContainer with the default center and zoom', () => {
    renderMap();
    const container = screen.getByTestId('map-container');
    expect(JSON.parse(container.getAttribute('data-center')!)).toEqual([34.7465, -92.2896]);
    expect(container.getAttribute('data-zoom')).toBe('12');
  });

  it('forwards the provided center and zoom props', () => {
    renderMap({ center: [40, -74], zoom: 5 });
    const container = screen.getByTestId('map-container');
    expect(JSON.parse(container.getAttribute('data-center')!)).toEqual([40, -74]);
    expect(container.getAttribute('data-zoom')).toBe('5');
  });

  it('applies the default className and merges in a custom className', () => {
    const { rerender } = renderMap();
    expect(screen.getByTestId('map-container').className).toContain('h-[600px]');
    expect(screen.getByTestId('map-container').className).toContain('w-full');

    rerender(
      <IntlProvider locale="en" defaultLocale="en">
        <MemoryRouter>
          <MapView posts={[]} className="h-[200px]" />
        </MemoryRouter>
      </IntlProvider>,
    );
    expect(screen.getByTestId('map-container').className).toContain('h-[200px]');
  });

  it('renders an OpenStreetMap tile layer with attribution', () => {
    renderMap();
    const tile = screen.getByTestId('tile-layer');
    expect(tile.getAttribute('data-url')).toBe(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(tile.getAttribute('data-attribution')).toMatch(/openstreetmap/i);
  });
});

describe('MapView — markers', () => {
  it('renders one marker per geolocated post inside the cluster group', () => {
    renderMap({
      posts: [
        makePost({ id: 'p1', latitude: 1, longitude: 2 }),
        makePost({ id: 'p2', latitude: 3, longitude: 4 }),
      ],
    });
    expect(screen.getByTestId('cluster-group')).toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

  it('filters out posts that are missing latitude or longitude', () => {
    renderMap({
      posts: [
        makePost({ id: 'p1', latitude: 1, longitude: 2 }),
        makePost({ id: 'p2', latitude: null, longitude: 4 }),
        makePost({ id: 'p3', latitude: 3, longitude: null }),
        makePost({ id: 'p4', latitude: null, longitude: null }),
      ],
    });
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(JSON.parse(markers[0].getAttribute('data-position')!)).toEqual([1, 2]);
  });

  it('uses the orange request icon for REQUEST posts', () => {
    renderMap({
      posts: [makePost({ id: 'p1', type: 'REQUEST', latitude: 1, longitude: 2 })],
    });
    expect(screen.getByTestId('marker').getAttribute('data-icon')).toMatch(
      /marker-icon-orange\.png$/,
    );
  });

  it('uses the green offer icon for OFFER posts', () => {
    renderMap({
      posts: [makePost({ id: 'p1', type: 'OFFER', latitude: 1, longitude: 2 })],
    });
    expect(screen.getByTestId('marker').getAttribute('data-icon')).toMatch(
      /marker-icon-green\.png$/,
    );
  });

  it('uses the violet event icon for EVENT posts', () => {
    renderMap({
      posts: [makePost({ id: 'p1', type: 'EVENT', latitude: 1, longitude: 2 })],
    });
    expect(screen.getByTestId('marker').getAttribute('data-icon')).toMatch(
      /marker-icon-violet\.png$/,
    );
  });

  it('uses the blue comms icon for COMMS posts', () => {
    renderMap({
      posts: [makePost({ id: 'p1', type: 'COMMS', latitude: 1, longitude: 2 })],
    });
    expect(screen.getByTestId('marker').getAttribute('data-icon')).toMatch(
      /marker-icon-blue\.png$/,
    );
  });

  it('renders no markers when no posts are geolocated', () => {
    renderMap({ posts: [makePost({ latitude: null, longitude: null })] });
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });
});

describe('MapView — selection', () => {
  it('selects the single post when its marker is clicked', () => {
    const onSelectPosts = vi.fn();
    const post = makePost({ id: 'p1', latitude: 1, longitude: 2 });
    renderMap({ posts: [post], onSelectPosts });

    fireEvent.click(screen.getByTestId('marker'));
    expect(onSelectPosts).toHaveBeenCalledWith([post]);
  });

  it('selects all co-located posts when their cluster is clicked', () => {
    const onSelectPosts = vi.fn();
    const a = makePost({ id: 'a', latitude: 1, longitude: 2 });
    const b = makePost({ id: 'b', latitude: 1, longitude: 2 });
    const c = makePost({ id: 'c', latitude: 3, longitude: 4 });
    renderMap({ posts: [a, b, c], onSelectPosts });

    // Cluster of the two posts that share (1, 2): zero-area bounds → list.
    capturedClusterHandlers.onClick!({
      type: 'clusterclick',
      layer: fakeCluster([
        [1, 2],
        [1, 2],
      ]),
    });
    expect(onSelectPosts).toHaveBeenCalledWith([a, b]);
  });

  it('zooms into a splittable cluster instead of selecting when not maxed out', () => {
    const onSelectPosts = vi.fn();
    const a = makePost({ id: 'a', latitude: 1, longitude: 2 });
    const b = makePost({ id: 'b', latitude: 3, longitude: 4 });
    renderMap({ posts: [a, b], onSelectPosts });

    const cluster = fakeCluster([
      [1, 2],
      [3, 4],
    ]);
    capturedClusterHandlers.onClick!({ type: 'clusterclick', layer: cluster });

    expect(cluster.zoomToBounds).toHaveBeenCalled();
    expect(onSelectPosts).not.toHaveBeenCalled();
  });

  it('selects a spread cluster (rather than zooming) when already at max zoom', () => {
    mapStub.getZoom.mockReturnValue(18); // == getMaxZoom()
    const onSelectPosts = vi.fn();
    const a = makePost({ id: 'a', latitude: 1, longitude: 2 });
    const b = makePost({ id: 'b', latitude: 3, longitude: 4 });
    renderMap({ posts: [a, b], onSelectPosts });

    capturedClusterHandlers.onClick!({
      type: 'clusterclick',
      layer: fakeCluster([
        [1, 2],
        [3, 4],
      ]),
    });
    expect(onSelectPosts).toHaveBeenCalledWith([a, b]);
  });

  it('ignores a cluster keypress that is not Enter', () => {
    const onSelectPosts = vi.fn();
    const a = makePost({ id: 'a', latitude: 1, longitude: 2 });
    const b = makePost({ id: 'b', latitude: 1, longitude: 2 });
    renderMap({ posts: [a, b], onSelectPosts });

    capturedClusterHandlers.onKeypress!({
      type: 'clusterkeypress',
      originalEvent: { key: 'a' },
      layer: fakeCluster([
        [1, 2],
        [1, 2],
      ]),
    });
    expect(onSelectPosts).not.toHaveBeenCalled();
  });

  it('selects co-located posts on an Enter cluster keypress', () => {
    const onSelectPosts = vi.fn();
    const a = makePost({ id: 'a', latitude: 1, longitude: 2 });
    const b = makePost({ id: 'b', latitude: 1, longitude: 2 });
    renderMap({ posts: [a, b], onSelectPosts });

    capturedClusterHandlers.onKeypress!({
      type: 'clusterkeypress',
      originalEvent: { key: 'Enter' },
      layer: fakeCluster([
        [1, 2],
        [1, 2],
      ]),
    });
    expect(onSelectPosts).toHaveBeenCalledWith([a, b]);
  });

  it('clears the selection on an empty-map click', () => {
    const onSelectPosts = vi.fn();
    renderMap({ posts: [makePost({ id: 'p1', latitude: 1, longitude: 2 })], onSelectPosts });

    capturedMapEvents.click!(undefined);
    expect(onSelectPosts).toHaveBeenCalledWith([]);
  });
});
