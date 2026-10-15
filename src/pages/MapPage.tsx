import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  LocateFixed,
  MapPin,
  Calendar,
  X,
  PlusCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
import { config } from '../config/env';
import { useAppData } from '../data/AppDataProvider';
import { useI18n } from '../i18n/I18nProvider';
import { formatDate } from '../domain/dates';
import { formatLocationForClipboard, reportMapLocation } from '../domain/geo';
import type { PriceObservation, Product } from '../domain/types';
import { demoPhotoUrl } from '../data/demo/photos';
import { getReportRating, voteReport, getAccuracyPct, type ReportRating } from '../data/ratings';
import { platform } from '../platform/platform';
import { ErrorState, Spinner } from '../components/ui';

// Filter chips without any emojis
const PRODUCT_FILTERS = [
  { id: 'all', label: 'All Foods' },
  { id: 'potatoes', label: 'Potatoes' },
  { id: 'milk-pasteurised-bag', label: 'Milk' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'chicken-whole', label: 'Chicken' },
  { id: 'tomatoes', label: 'Tomatoes' },
  { id: 'vegetable-oil', label: 'Oil' },
  { id: 'flour', label: 'Flour' },
];

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface PictureCardPinProps {
  obs: PriceObservation;
  pinLat: number;
  pinLng: number;
  prodName: string;
  priceNum: number;
  photoUrl: string;
  isSelected: boolean;
  onSelect: (obs: PriceObservation) => void;
}

type DisplayPin = PriceObservation & {
  displayLat: number;
  displayLng: number;
};

const PictureCardPin = memo(function PictureCardPin({
  obs,
  pinLat,
  pinLng,
  prodName,
  priceNum,
  photoUrl,
  isSelected,
  onSelect,
}: PictureCardPinProps) {
  const customIcon = useMemo(() => {
    return L.divIcon({
      className: 'as3-marker-container',
      html: `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #ffffff;
          border: ${isSelected ? '2.5px solid #174c30' : '1.5px solid #174c30'};
          border-radius: 20px;
          padding: 3px 9px 3px 3px;
          box-shadow: ${isSelected ? '0 4px 14px rgba(23,76,48,0.2)' : '0 2px 6px rgba(0,0,0,0.12)'};
          cursor: pointer;
          white-space: nowrap;
          position: relative;
          will-change: transform;
          transform: translateZ(0) ${isSelected ? 'scale(1.06)' : 'scale(1)'};
        ">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            overflow: hidden;
            background: #f1f5f9;
            flex-shrink: 0;
            border: 1px solid #e2e8f0;
          ">
            <img src="${escapeXml(photoUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
          </div>
          <div style="display: flex; flex-direction: column; line-height: 1.15; text-align: left;">
            <span style="font-size: 10px; font-weight: 700; color: #475569; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeXml(prodName)}</span>
            <span style="font-size: 12px; font-weight: 900; color: #174c30;">${priceNum} <span style="font-size: 9px; font-weight: 700; color: #64748b;">DZD</span></span>
          </div>
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid #174c30;
          "></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [35, 20],
    });
  }, [prodName, priceNum, photoUrl, isSelected]);

  return (
    <Marker
      position={[pinLat, pinLng]}
      icon={customIcon}
      eventHandlers={{
        click: () => onSelect(obs),
      }}
    />
  );
});

export default function MapPage() {
  const { t, name, locale } = useI18n();
  const { repo, catalog, priceRevision } = useAppData();
  const cat = catalog.data;

  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [observations, setObservations] = useState<PriceObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Selected Pin for detailed card
  const [selectedPin, setSelectedPin] = useState<PriceObservation | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, ReportRating>>({});

  const handlePinVote = (obsId: string, type: 'like' | 'dislike', corroborating = 0) => {
    const updated = voteReport(obsId, type, corroborating);
    setRatingsMap((prev) => ({ ...prev, [obsId]: updated }));
  };

  // User GPS position
  const [userGps, setUserGps] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Load observations
  const loadData = useCallback(async () => {
    if (!cat) return;
    setLoading(true);
    setError(false);
    try {
      const nationwide: PriceObservation[] = [];
      let offset = 0;
      let total: number | null = null;
      do {
        const page = await repo.listObservations({ limit: 500, offset });
        nationwide.push(...page.items);
        if (page.total === null || page.items.length === 0) break;
        offset += page.items.length;
        total = page.total;
      } while (total !== null && offset < total);
      setObservations(nationwide);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cat, repo]);

  useEffect(() => {
    if (cat) {
      loadData();
    }
  }, [cat, loadData, priceRevision]);

  // Center coordinates: selected Wilaya center or national Algeria center
  const mapCenter = useMemo<[number, number]>(() => {
    if (userGps) return userGps;
    return [28.0339, 1.6596]; // Geographic center of Algeria
  }, [userGps]);

  const mapZoom = userGps ? 13 : 5;

  // Filter observations by product filter
  const filteredObservations = useMemo(() => {
    return observations.filter((o) => {
      if (selectedProductFilter !== 'all' && o.product_id !== selectedProductFilter) {
        return false;
      }
      return true;
    });
  }, [observations, selectedProductFilter]);

  // Priority pins: User reports first, then newest, capped at top 60 for snappy 60fps mobile rendering.
  // Nearby pins are subtly spread apart so dense clusters remain readable.
  const displayPins = useMemo(() => {
    const wilayas = cat?.wilayas ?? [];
    const newest = filteredObservations
      .flatMap((observation): DisplayPin[] => {
        const location = reportMapLocation(
          { lat: observation.lat, lng: observation.lng, wilayaCode: observation.wilaya_code },
          wilayas,
        );
        return location
          ? [{
              ...observation,
              displayLat: location.position.lat,
              displayLng: location.position.lng,
            }]
          : [];
      })
      .sort((a, b) => {
        if (!a.is_demo && b.is_demo) return -1;
        if (a.is_demo && !b.is_demo) return 1;
        return b.observed_on.localeCompare(a.observed_on);
      });

    const byWilaya = new Map<string, DisplayPin[]>();
    for (const observation of newest) {
      const key = observation.wilaya_code === null ? 'unknown' : String(observation.wilaya_code);
      const group = byWilaya.get(key) ?? [];
      group.push(observation);
      byWilaya.set(key, group);
    }

    // Give each represented wilaya a recent pin before showing a second from any one area.
    const ranked: DisplayPin[] = [];
    for (let rank = 0; ranked.length < 60; rank += 1) {
      let added = false;
      for (const group of byWilaya.values()) {
        if (group[rank]) {
          ranked.push(group[rank]!);
          added = true;
          if (ranked.length === 60) break;
        }
      }
      if (!added) break;
    }

    const counts = new Map<string, number>();
    return ranked.map((obs) => {
      const baseLat = obs.displayLat;
      const baseLng = obs.displayLng;
      const key = `${Math.round(baseLat * 100000)}:${Math.round(baseLng * 100000)}`;
      const index = counts.get(key) ?? 0;
      counts.set(key, index + 1);
      const angle = (index % 8) * (Math.PI / 4) + (index > 7 ? 0.5 : 0);
      const radius = index === 0 ? 0 : 0.00016 + index * 0.00008;
      return {
        ...obs,
        displayLat: obs.displayLat + Math.cos(angle) * radius,
        displayLng: obs.displayLng + Math.sin(angle) * radius,
      };
    });
  }, [cat?.wilayas, filteredObservations]);

  const productMap = useMemo(() => {
    if (!cat) return new Map<string, Product>();
    return new Map(cat.products.map((p) => [p.id, p]));
  }, [cat]);

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const pos = await platform.getCurrentPosition();
      setUserGps([pos.lat, pos.lng]);
    } catch {
      // Graceful fallback
    } finally {
      setLocating(false);
    }
  };

  if (!cat) {
    return (
      <div className="flex h-full items-center justify-center">
        {catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />}
      </div>
    );
  }

  if (loading && observations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error && observations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ErrorState onRetry={loadData} />
      </div>
    );
  }

  const currentWilayaName = t('feed.allAlgeria');

  const handleCopyLocation = async (obs: PriceObservation) => {
    const text = formatLocationForClipboard({ lat: obs.lat, lng: obs.lng, labels: [obs.location_label] });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op; the app still keeps the location visible on-screen.
    }
  };

  const handleDirections = (obs: PriceObservation) => {
    const location = reportMapLocation(
      { lat: obs.lat, lng: obs.lng, wilayaCode: obs.wilaya_code },
      cat.wilayas,
    );
    if (!location) return;
    const { lat, lng } = location.position;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-canvas">
      {/* Top Controls Toolbar */}
      <div className="z-[1100] shrink-0 border-b border-line bg-surface px-3 py-2.5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Active location indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <MapPin className="size-4" />
            </span>
            <div>
              <span className="font-extrabold text-ink">{currentWilayaName}</span>
              <span className="ms-1.5 text-[11px] text-muted font-semibold">
                ({filteredObservations.length} {t('trends.reportsUnit')})
              </span>
            </div>
          </div>

          {/* GPS locate button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 shadow-xs hover:bg-canvas disabled:opacity-50"
          >
            {locating ? <span className="size-3.5 animate-pulse rounded bg-brand-600/25" /> : <LocateFixed className="size-3.5 text-brand-600" />}
            <span className="hidden sm:inline">
              {locating ? t('contribute.locating') : t('contribute.useMyLocation')}
            </span>
          </button>
        </div>

        {/* Product Filter Chips Carousel (No emojis) */}
        <div className="scrollbar-none -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
          {PRODUCT_FILTERS.map((f) => {
            const isSelected = selectedProductFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedProductFilter(f.id);
                  setSelectedPin(null);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                    : 'border-line bg-surface text-ink-2 hover:bg-canvas'
                }`}
              >
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Content */}
      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full z-0"
          zoomControl={true}
          preferCanvas={true}
          bounceAtZoomLimits={false}
          wheelDebounceTime={100}
        >
          <TileLayer
            url={config.map.tileUrl}
            attribution={config.map.attribution}
            maxZoom={19}
            updateWhenIdle={true}
            keepBuffer={4}
          />

          {/* Render Picture Card Markers on Map (snappy 60fps) */}
          {displayPins.map((obs) => {
            const prod = productMap.get(obs.product_id);
            const prodName = prod ? name(prod) : obs.product_id;
            const priceNum = Math.round(Number(obs.price));
            const photoUrl = obs.photo_url || demoPhotoUrl(obs.product_id, String(priceNum));

            return (
              <PictureCardPin
                key={obs.id}
                obs={obs}
                pinLat={obs.displayLat}
                pinLng={obs.displayLng}
                prodName={prodName}
                priceNum={priceNum}
                photoUrl={photoUrl}
                isSelected={selectedPin?.id === obs.id}
                onSelect={setSelectedPin}
              />
            );
          })}
        </MapContainer>

        {/* Selected Pin Detailed Card Overlay */}
        {selectedPin && (
          <div className="absolute bottom-4 inset-x-4 z-[1000] flex justify-center animate-in slide-in-from-bottom duration-200">
            <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-float">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas border border-line">
                    <img
                      src={selectedPin.photo_url || demoPhotoUrl(selectedPin.product_id, selectedPin.price)}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-ink">
                      {productMap.get(selectedPin.product_id)
                        ? name(productMap.get(selectedPin.product_id)!)
                        : selectedPin.product_id}
                    </h3>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="num text-2xl font-black text-brand-700">
                        {Math.round(Number(selectedPin.price))}
                      </span>
                      <span className="text-xs font-bold text-muted">DZD</span>
                      {selectedPin.normalized_price && (
                        <span className="num ms-1 text-xs font-semibold text-muted">
                          (≈ {Math.round(Number(selectedPin.normalized_price))} DZD/
                          {selectedPin.comparison_unit})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPin(null)}
                  className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink"
                  aria-label={t('nav.close')}
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Observation Metadata */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 text-xs text-muted">
                {selectedPin.location_label && (
                  <div className="flex items-center gap-1 text-ink-2 font-medium">
                    <MapPin className="size-3.5 text-brand-600" />
                    <span>{selectedPin.location_label}</span>
                  </div>
                )}
                {reportMapLocation(
                  { lat: selectedPin.lat, lng: selectedPin.lng, wilayaCode: selectedPin.wilaya_code },
                  cat.wilayas,
                )?.approximate && (
                  <span className="text-muted">{t('map.approximateLocation')}</span>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  <span>{formatDate(selectedPin.observed_on, locale)}</span>
                </div>
                <div className="flex items-center gap-1 font-medium text-ink-2">
                  <User className="size-3.5 text-muted" />
                  <span>
                    {selectedPin.is_anonymous || !selectedPin.reporter_name
                      ? t('feed.anonymousReport')
                      : `@${selectedPin.reporter_name}`}
                  </span>
                </div>
                {selectedPin.is_demo && (
                  <span className="rounded-full bg-demo-bg px-2 py-0.5 text-[10px] font-bold text-demo">
                    {t('common.demo')}
                  </span>
                )}
              </div>

              {/* Community Accuracy & Rating */}
              {(() => {
                const rating = ratingsMap[selectedPin.id] ?? getReportRating(selectedPin.id, selectedPin.corroborating_reports);
                const accuracy = getAccuracyPct(rating.likes, rating.dislikes);
                return (
                  <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                    <span className="font-bold text-good flex items-center gap-1">
                      <ThumbsUp className="size-3.5 fill-good" />
                      <span>{accuracy !== null ? `${accuracy}% accurate` : 'Verified'}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePinVote(selectedPin.id, 'like', selectedPin.corroborating_reports)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold transition-all ${
                          rating.userVote === 'like'
                            ? 'bg-good-bg text-good border border-good'
                            : 'bg-surface text-ink-2 border border-line hover:bg-canvas'
                        }`}
                      >
                        <ThumbsUp className={`size-3 ${rating.userVote === 'like' ? 'fill-good' : ''}`} />
                        <span>{rating.likes}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePinVote(selectedPin.id, 'dislike', selectedPin.corroborating_reports)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold transition-all ${
                          rating.userVote === 'dislike'
                            ? 'bg-danger-bg text-danger border border-danger'
                            : 'bg-surface text-ink-2 border border-line hover:bg-canvas'
                        }`}
                      >
                        <ThumbsDown className={`size-3 ${rating.userVote === 'dislike' ? 'fill-danger' : ''}`} />
                        {rating.dislikes > 0 && <span>{rating.dislikes}</span>}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Action: Report a price at this location or product */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to={`/contribute?product=${selectedPin.product_id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-700"
                >
                  <PlusCircle className="size-3.5" />
                  <span>{t('feed.reportAgain')}</span>
                </Link>
                <Link
                  to="/plan"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink-2 hover:bg-canvas"
                >
                  <Sparkles className="size-3.5 text-brand-600" />
                  <span>{t('nav.plan')}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDirections(selectedPin)}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink-2 hover:bg-canvas"
                >
                  Directions
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyLocation(selectedPin)}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink-2 hover:bg-canvas"
                >
                  Copy location
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
