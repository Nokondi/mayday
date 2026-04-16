import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';

/**
 * react-leaflet renders a real Leaflet map, which depends on DOM APIs jsdom
 * does not implement (canvas, layout, etc.). For a unit test we don't care
 * about the map itself — only that MapView forwards the correct props to it,
 * emits one Marker per geolocated post, and assigns the right icon per post
 * type. A thin stub of react-leaflet captures those decisions and renders
 * them as plain DOM so we can assert on them.
 */
const lastPropsCapture: { map: unknown } = { map: null };

vi.mock('react-leaflet', () => {
  const MapContainer = ({ children, ...props }: Record<string, unknown>) => {
    lastPropsCapture.map = props;
    return (
      <div
        data-testid="map-container"
        data-center={JSON.stringify((props as { center: unknown }).center)}
        data-zoom={String((props as { zoom: unknown }).zoom)}
        className={(props as { className?: string }).className}
      >
        {children as React.ReactNode}
      </div>
    );
  };

  const TileLayer = (props: Record<string, unknown>) => (
    <div
      data-testid="tile-layer"
      data-url={String((props as { url: unknown }).url)}
      data-attribution={String((props as { attribution: unknown }).attribution)}
    />
  );

  const Marker = ({ position, icon, children }: Record<string, unknown> & { children?: React.ReactNode }) => {
    const typedIcon = icon as { options?: { iconUrl?: string } } | undefined;
    return (
      <div
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-icon={typedIcon?.options?.iconUrl ?? ''}
      >
        {children}
      </div>
    );
  };

  const Popup = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  );

  return {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap: () => ({ setView: vi.fn() }),
    useMapEvents: () => null,
  };
});

// Avoid "leaflet/dist/leaflet.css" import errors in jsdom.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import { MapView } from '../../../src/components/map/MapView.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: 'Somewhere',
    latitude: 34.7,
    longitude: -92.3,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    communityId: null,
    images: [],
    fulfillments: [],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    community: null,
    ...overrides,
  };
}

function renderMap(props: Partial<Parameters<typeof MapView>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MapView posts={[]} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  lastPropsCapture.map = null;
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
      <MemoryRouter>
        <MapView posts={[]} className="h-[200px]" />
      </MemoryRouter>,
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
  it('renders one marker per geolocated post', () => {
    renderMap({
      posts: [
        makePost({ id: 'p1', latitude: 1, longitude: 2 }),
        makePost({ id: 'p2', latitude: 3, longitude: 4 }),
      ],
    });
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

  it('renders a popup containing the post details inside each marker', () => {
    renderMap({
      posts: [
        makePost({
          id: 'p1',
          title: 'Need groceries',
          latitude: 1,
          longitude: 2,
        }),
      ],
    });
    const popup = screen.getByTestId('popup');
    expect(within(popup).getByRole('heading', { name: 'Need groceries' })).toBeInTheDocument();
  });

  it('renders no markers when no posts are geolocated', () => {
    renderMap({ posts: [makePost({ latitude: null, longitude: null })] });
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });
});
