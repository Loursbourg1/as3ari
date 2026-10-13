/**
 * Map adapter. The rest of the app only knows about MapMarker/PriceMapProps, so the
 * map provider (Leaflet today) can be replaced without touching product logic.
 */
import { useEffect, useMemo, useRef } from 'react';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { config } from '../config/env';
import type { LatLng } from '../domain/geo';

export type MarkerState = 'lowest' | 'recent' | 'aging' | 'stale' | 'none';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Accessible name (shop name). Set as a DOM property by Leaflet, never parsed as HTML. */
  label: string;
  /** Short numeric price text, e.g. "90". Escaped before use in marker markup. */
  priceText?: string;
  unitText?: string;
  state: MarkerState;
  demo: boolean;
}

export interface PriceMapProps {
  center: LatLng;
  zoom: number;
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userPosition?: LatLng | null;
  /** Changing this value refits the view to the markers. */
  fitKey?: string;
  /** Fraction (0–1) of the map height hidden by an overlay at the bottom (mobile sheet). */
  bottomInset?: number;
  ariaLabel: string;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

function iconFor(m: MapMarker, selected: boolean): L.DivIcon {
  const cls = [m.state !== 'none' && m.state !== 'recent' ? `is-${m.state}` : '', selected ? 'is-selected' : '', m.demo ? 'is-demo' : '']
    .filter(Boolean)
    .join(' ');
  if (m.priceText) {
    return L.divIcon({
      className: 'as3-marker',
      html: `<span class="as3-pin ${cls}">${escapeHtml(m.priceText)}<small>${escapeHtml(m.unitText ?? '')}</small></span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 6],
    });
  }
  return L.divIcon({
    className: 'as3-marker',
    html: `<span class="as3-dot ${m.state === 'none' ? 'is-muted' : ''} ${cls}"></span>`,
    iconSize: [0, 0],
  });
}

function ViewController({ center, zoom, markers, fitKey, bottomInset = 0 }: Pick<PriceMapProps, 'center' | 'zoom' | 'markers' | 'fitKey' | 'bottomInset'>) {
  const map = useMap();
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);
  useEffect(() => {
    if (fitKey === undefined || fitKey === last.current) return;
    last.current = fitKey;
    const priced = markers.filter((m) => m.priceText);
    const pts = (priced.length ? priced : markers).map((m) => [m.lat, m.lng] as [number, number]);
    const h = map.getSize().y;
    if (pts.length >= 1) {
      map.fitBounds(pts, { paddingTopLeft: [48, 56], paddingBottomRight: [48, 40 + h * bottomInset], maxZoom: 16 });
    }
  }, [map, fitKey, markers, bottomInset]);
  return null;
}

/** Keep the selected marker inside the part of the map that is not covered by the sheet. */
function SelectedPanner({ markers, selectedId, bottomInset = 0 }: { markers: MapMarker[]; selectedId: string | null; bottomInset?: number }) {
  const map = useMap();
  useEffect(() => {
    const m = markers.find((x) => x.id === selectedId);
    if (!m) return;
    const size = map.getSize();
    const visibleH = size.y * (1 - bottomInset);
    const pt = map.latLngToContainerPoint([m.lat, m.lng]);
    if (pt.x > 40 && pt.x < size.x - 40 && pt.y > 60 && pt.y < visibleH - 30) return;
    // Move the marker to the centre of the uncovered area.
    map.panBy(pt.subtract([size.x / 2, visibleH / 2]));
  }, [map, markers, selectedId, bottomInset]);
  return null;
}

export default function PriceMap(props: PriceMapProps) {
  const { markers, selectedId, onSelect, userPosition } = props;
  const meIcon = useMemo(() => L.divIcon({ className: 'as3-marker', html: '<span class="as3-me"></span>', iconSize: [0, 0] }), []);
  return (
    <div className="h-full w-full" role="region" aria-label={props.ariaLabel}>
      <MapContainer
        center={[props.center.lat, props.center.lng]}
        zoom={props.zoom}
        zoomControl={false}
        className="h-full w-full"
        attributionControl={false}
        preferCanvas={false}
      >
        <TileLayer url={config.map.tileUrl} attribution={config.map.attribution} maxZoom={config.map.maxZoom} />
        {/* Attribution sits top-right so the mobile bottom sheet never hides it. */}
        <AttributionControl position="topright" prefix={false} />
        <ZoomControl position="bottomright" />
        <ViewController center={props.center} zoom={props.zoom} markers={markers} fitKey={props.fitKey} bottomInset={props.bottomInset} />
        <SelectedPanner markers={markers} selectedId={selectedId} bottomInset={props.bottomInset} />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={iconFor(m, m.id === selectedId)}
            title={m.label}
            alt={m.label}
            keyboard
            riseOnHover
            zIndexOffset={m.id === selectedId ? 1000 : m.state === 'lowest' ? 500 : m.priceText ? 100 : 0}
            eventHandlers={{ click: () => onSelect(m.id) }}
          />
        ))}
        {userPosition && <Marker position={[userPosition.lat, userPosition.lng]} icon={meIcon} interactive={false} keyboard={false} />}
      </MapContainer>
    </div>
  );
}
