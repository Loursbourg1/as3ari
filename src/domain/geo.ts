export interface LatLng {
  lat: number;
  lng: number;
}

export interface ReportMapLocation {
  position: LatLng;
  approximate: boolean;
}

export function reportMapLocation(
  input: { lat?: number | null; lng?: number | null; wilayaCode?: number | null },
  wilayas: readonly { code: number; center_lat: number | null; center_lng: number | null }[],
): ReportMapLocation | null {
  if (
    input.lat != null
    && input.lng != null
    && Number.isFinite(input.lat)
    && Number.isFinite(input.lng)
    && input.lat >= -90
    && input.lat <= 90
    && input.lng >= -180
    && input.lng <= 180
  ) {
    return { position: { lat: input.lat, lng: input.lng }, approximate: false };
  }

  if (input.wilayaCode == null) return null;
  const wilaya = wilayas.find((item) => item.code === input.wilayaCode);
  if (
    !wilaya
    || wilaya.center_lat == null
    || wilaya.center_lng == null
    || !Number.isFinite(wilaya.center_lat)
    || !Number.isFinite(wilaya.center_lng)
  ) {
    return null;
  }
  return { position: { lat: wilaya.center_lat, lng: wilaya.center_lng }, approximate: true };
}

export function formatLocationForClipboard(input: {
  lat?: number | null;
  lng?: number | null;
  labels: (string | null | undefined)[];
}): string {
  const labels = [...new Set(input.labels.map((label) => label?.trim()).filter((label): label is string => Boolean(label)))];
  const lines = [...labels];
  if (input.lat != null && input.lng != null) {
    const coordinates = `${input.lat},${input.lng}`;
    lines.push(`Coordinates: ${coordinates}`, `Google Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`);
  }
  return lines.join('\n');
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
