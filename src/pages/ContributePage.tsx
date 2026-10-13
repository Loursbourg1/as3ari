import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import {
  Camera,
  CheckCircle2,
  Info,
  MapPin,
  Navigation,
  Tag,
  Trash2,
  User,
  UserX,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { ApiError, type SubmitResult } from '../data/repository';
import { addDays } from '../domain/dates';
import { formatDZD, parseMoney, parseQuantity } from '../domain/money';
import { priceReportInput } from '../domain/reportSchema';
import { normalizeUnitPrice, quantityWithinBounds, unitsForDimension } from '../domain/units';
import type { UnitCode, Product } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { platform } from '../platform/platform';
import { compressImageFile } from '../lib/image';
import { SearchBox } from '../components/SearchBox';
import { GoogleCaptcha } from '../components/GoogleCaptcha';
import { Button, ErrorState, Field, Notice, PageContainer, Select, Spinner, TextInput } from '../components/ui';

export default function ContributePage() {
  const { t, name, variant, locale } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const { catalog, contributions, today, wilayaCode, setWilayaCode } = useAppData();
  const [params] = useSearchParams();

  const cat = catalog.data;

  // Form states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => {
    const id = params.get('product');
    return id && cat ? cat.products.find((p) => p.id === id) ?? null : null;
  });

  const [formWilayaCode, setFormWilayaCode] = useState<number>(wilayaCode);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [locationLabel, setLocationLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<UnitCode | ''>('');
  const [observedOn, setObservedOn] = useState(today);

  // Photo state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [gpsLocating, setGpsLocating] = useState(false);

  // Attribution & verification state
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState(() => auth.username ?? '');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Submission state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.username && !reporterName) {
      setReporterName(auth.username);
    }
  }, [auth.username, reporterName]);

  // Keep selected product in sync if params change
  useEffect(() => {
    if (!cat) return;
    const id = params.get('product');
    if (id) {
      const p = cat.products.find((item) => item.id === id);
      if (p) setSelectedProduct(p);
    }
  }, [cat, params]);

  // Communes in active wilaya
  const communesInWilaya = cat ? cat.areas.filter((a) => a.wilaya_code === formWilayaCode) : [];

  const units = selectedProduct ? unitsForDimension(selectedProduct.dimension) : [];
  const effectiveUnit: UnitCode | '' =
    unit && units.includes(unit) ? unit : (units.find((u) => u === 'kg' || u === 'l' || u === 'piece') ?? '');

  const previewPrice = parseMoney(price);
  const previewQty = parseQuantity(quantity);
  const normalized =
    selectedProduct && previewPrice && previewQty && effectiveUnit
      ? normalizeUnitPrice(previewPrice, previewQty, effectiveUnit, selectedProduct.dimension)
      : null;
  const preview = normalized?.ok ? normalized : null;

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoProcessing(true);
    setError(null);
    try {
      const dataUrl = await compressImageFile(file, 1024, 0.75);
      setPhotoDataUrl(dataUrl);
    } catch {
      setError(t('errors.missing_photo'));
    } finally {
      setPhotoProcessing(false);
    }
  };

  const handleGetLocation = async () => {
    setGpsLocating(true);
    setError(null);
    try {
      const pos = await platform.getCurrentPosition();
      setLat(Number(pos.lat.toFixed(6)));
      setLng(Number(pos.lng.toFixed(6)));
    } catch {
      setError(t('errors.location_error'));
    } finally {
      setGpsLocating(false);
    }
  };

  if (auth.loading) return <Spinner />;
  if (!auth.available) {
    return (
      <PageContainer>
        <h1 className="text-2xl font-bold">{t('contribute.title')}</h1>
        <div className="mt-4" data-testid="contribute-unavailable">
          <Notice tone="demo">{t('contribute.accountsUnavailable')}</Notice>
        </div>
      </PageContainer>
    );
  }
  if (!auth.session)
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!cat) return catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />;

  if (result) {
    return (
      <PageContainer className="max-w-lg">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card" data-testid="contribute-success">
          <CheckCircle2 className="size-10 text-good" aria-hidden />
          <h1 className="mt-3 text-xl font-extrabold text-ink">{t('contribute.success.title')}</h1>
          <p className="mt-1 text-sm font-semibold" data-testid="report-status">
            {t('contribute.success.status', { status: t(`me.status.${result.status}`) })}
          </p>
          <p className="mt-2 text-sm text-ink-2">{t('contribute.success.body')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-xs hover:bg-brand-700"
            >
              <Tag className="size-4" />
              <span>{t('feed.title')}</span>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setPrice('');
                setPhotoDataUrl(null);
                setLocationLabel('');
              }}
            >
              {t('contribute.another')}
            </Button>
            <Link
              to="/me"
              className="inline-flex h-10 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-2 hover:bg-canvas"
            >
              {t('contribute.viewMine')}
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fe: Record<string, string> = {};
    const p = parseMoney(price);
    const q = parseQuantity(quantity);

    if (!selectedProduct) fe.product = t('errors.unknown_product');
    const selectedCommuneName = communesInWilaya.find((a) => a.id === selectedAreaId);
    const computedLocationLabel =
      locationLabel.trim() ||
      (selectedCommuneName ? name(selectedCommuneName) : cat?.wilayas.find((w) => w.code === formWilayaCode)?.name_fr) ||
      '';

    if (!computedLocationLabel) fe.location = t('contribute.locationRequired');
    if (!p) fe.price = t('errors.invalid_price');
    if (!q || !effectiveUnit || !quantityWithinBounds(q, effectiveUnit)) fe.quantity = t('errors.invalid_quantity');
    if (observedOn > today || observedOn < addDays(today, -30)) fe.date = t('errors.invalid_date');
    if (!isAnonymous && !reporterName.trim()) fe.reporterName = t('contribute.attribution.hint');

    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    const payload = {
      product_id: selectedProduct!.id,
      price: p!,
      quantity: q!,
      unit: effectiveUnit as UnitCode,
      observed_on: observedOn,
      location_label: computedLocationLabel,
      wilaya_code: formWilayaCode,
      area_id: selectedAreaId || null,
      lat: lat ?? null,
      lng: lng ?? null,
      photo_url: photoDataUrl ?? null,
      is_anonymous: isAnonymous,
      reporter_name: isAnonymous ? null : (reporterName.trim() || null),
      recaptcha_token: captchaToken ?? null,
    };

    const parseCheck = priceReportInput.safeParse(payload);
    if (!parseCheck.success) {
      setError(t('errors.invalid_input'));
      return;
    }

    setBusy(true);
    try {
      const res = await contributions.submitReport(parseCheck.data);
      if (formWilayaCode !== wilayaCode) {
        setWilayaCode(formWilayaCode);
      }
      setResult(res);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'server_error';
      setError(t(`errors.${code}` as MessageKey));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer className="max-w-lg pb-16">
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-ink">{t('contribute.title')}</h1>
        <p className="mt-1 text-sm text-ink-2">{t('contribute.intro')}</p>
      </div>

      {!auth.emailVerified && (
        <div className="mb-4">
          <Notice tone="warn">{t('contribute.verifyEmail')}</Notice>
        </div>
      )}

      <form
        onSubmit={submit}
        noValidate
        className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-card"
        aria-label={t('contribute.title')}
      >
        {/* 1. PRODUCT SELECTION */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-ink">
            1. {t('contribute.product')} <span className="text-danger">*</span>
          </label>
          <SearchBox
            catalog={cat}
            initialQuery={selectedProduct ? name(selectedProduct) : ''}
            onSelect={(p) => {
              setSelectedProduct(p);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.product;
                return next;
              });
            }}
            onClear={() => setSelectedProduct(null)}
          />

          {selectedProduct ? (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 p-2.5 text-xs text-brand-900 border border-brand-200">
              <span className="font-bold">
                {name(selectedProduct)} {variant(selectedProduct) ? `(${variant(selectedProduct)})` : ''}
              </span>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-xs font-semibold text-brand-700 underline"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {cat.categories.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const first = cat.products.find((p) => p.category_id === c.id);
                    if (first) setSelectedProduct(first);
                  }}
                  className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-canvas"
                >
                  {name(c)}
                </button>
              ))}
            </div>
          )}
          {fieldErrors.product && (
            <p className="text-xs font-semibold text-danger">{fieldErrors.product}</p>
          )}
        </div>

        {/* 2. PRICE & PACKAGE */}
        <div className="rounded-2xl bg-canvas p-3.5 space-y-3 border border-line/60">
          <label className="block text-sm font-bold text-ink">
            2. {t('contribute.price')} <span className="text-danger">*</span>
          </label>
          <Field label={t('contribute.price')} htmlFor="price" error={fieldErrors.price}>
            <div className="relative">
              <TextInput
                id="price"
                inputMode="decimal"
                autoComplete="off"
                placeholder="180"
                value={price}
                onChange={(e) => setPrice(e.target.value.slice(0, 12))}
                className="num text-xl font-black pe-14 rounded-xl"
              />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 font-bold text-sm text-muted">
                DZD
              </span>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('contribute.quantity')} htmlFor="quantity" error={fieldErrors.quantity}>
              <TextInput
                id="quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.slice(0, 10))}
                className="num rounded-xl"
              />
            </Field>
            <Field label={t('contribute.unit')} htmlFor="unit">
              <Select
                id="unit"
                value={effectiveUnit}
                onChange={(e) => setUnit(e.target.value as UnitCode)}
                disabled={!selectedProduct}
                className="rounded-xl"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {t(`common.unit.${u}` as MessageKey)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {preview && (
            <div className="rounded-xl bg-surface p-2.5 text-xs font-semibold text-brand-800 border border-brand-200">
              <span className="num">
                {t('contribute.preview', {
                  price: formatDZD(preview.value, locale),
                  unit: t(`common.perUnit.${preview.unit}` as MessageKey),
                })}
              </span>
            </div>
          )}
        </div>

        {/* 3. CONTRIBUTOR-REPORTED LOCATION */}
        <div className="rounded-2xl bg-canvas p-3.5 space-y-3 border border-line/60">
          <label className="block text-sm font-bold text-ink">
            3. {t('contribute.location')} <span className="text-danger">*</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('location.label')} htmlFor="wilayaSelect">
              <Select
                id="wilayaSelect"
                value={formWilayaCode}
                onChange={(e) => {
                  const code = Number(e.target.value);
                  setFormWilayaCode(code);
                  setSelectedAreaId('');
                }}
                className="rounded-xl"
              >
                {cat.wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} - {name(w)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('compare.filter.area')} htmlFor="communeSelect">
              <Select
                id="communeSelect"
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="rounded-xl"
              >
                <option value="">{t('feed.allAreas')}</option>
                {communesInWilaya.map((a) => (
                  <option key={a.id} value={a.id}>
                    {name(a)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label={t('contribute.locationName')}
            htmlFor="locationLabel"
            error={fieldErrors.location}
          >
            <TextInput
              id="locationLabel"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value.slice(0, 120))}
              placeholder={t('contribute.locationNameHint')}
              className="rounded-xl"
            />
          </Field>

          {/* Optional GPS convenient button */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={gpsLocating}
              className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
            >
              <Navigation className={`size-3.5 ${gpsLocating ? 'animate-spin' : ''}`} />
              {gpsLocating ? t('contribute.locating') : t('contribute.useMyLocation')}
            </button>
            {lat !== null && lng !== null && (
              <span className="flex items-center gap-1 text-good font-semibold">
                <MapPin className="size-3.5" />
                {t('contribute.locationFound')}
              </span>
            )}
          </div>
        </div>

        {/* 4. DATE OBSERVED */}
        <Field label={t('contribute.date')} htmlFor="date" error={fieldErrors.date}>
          <TextInput
            id="date"
            type="date"
            value={observedOn}
            max={today}
            min={addDays(today, -30)}
            onChange={(e) => setObservedOn(e.target.value)}
            className="rounded-xl"
          />
        </Field>

        {/* 5. PHOTO (OPTIONAL) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-ink">
            {t('contribute.photo')} <span className="text-muted text-xs font-normal">({t('common.optional')})</span>
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {photoDataUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-line bg-slate-900 aspect-video max-h-48">
              <img src={photoDataUrl} alt="Report evidence" className="h-full w-full object-contain" />
              <div className="absolute bottom-2 end-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm hover:bg-surface"
                >
                  {t('contribute.changePhoto')}
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="grid size-7 place-items-center rounded-lg bg-danger/90 text-white shadow-sm hover:bg-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={photoProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-3.5 text-center hover:border-brand-500 hover:bg-brand-50/20 transition-colors"
            >
              {photoProcessing ? (
                <Spinner />
              ) : (
                <>
                  <Camera className="size-4 text-brand-600" />
                  <span className="text-xs font-bold text-brand-700">{t('contribute.takePhoto')}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 6. CONTRIBUTOR ATTRIBUTION */}
        <div className="space-y-2 border-t border-line/70 pt-3">
          <label className="block text-sm font-bold text-ink">
            6. {t('contribute.attribution')}
          </label>
          <p className="text-xs text-muted">{t('contribute.attribution.hint')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsAnonymous(true)}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-start transition-all ${
                isAnonymous
                  ? 'border-brand-600 bg-brand-50/50 shadow-xs'
                  : 'border-line bg-surface hover:bg-canvas'
              }`}
            >
              <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                isAnonymous ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white'
              }`}>
                {isAnonymous && <span className="size-2 rounded-full bg-white" />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <UserX className="size-3.5 text-brand-700" />
                  <span className="text-xs font-bold text-ink">{t('contribute.attribution.anonymous')}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                  {t('contribute.attribution.anonymousDesc')}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsAnonymous(false)}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-start transition-all ${
                !isAnonymous
                  ? 'border-brand-600 bg-brand-50/50 shadow-xs'
                  : 'border-line bg-surface hover:bg-canvas'
              }`}
            >
              <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                !isAnonymous ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white'
              }`}>
                {!isAnonymous && <span className="size-2 rounded-full bg-white" />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <User className="size-3.5 text-brand-700" />
                  <span className="text-xs font-bold text-ink">{t('contribute.attribution.username')}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
                  {t('contribute.attribution.usernameDesc')}
                </p>
              </div>
            </button>
          </div>

          {!isAnonymous && (
            <div className="mt-2.5 space-y-1 animate-in fade-in duration-150">
              <label htmlFor="reporterName" className="block text-xs font-semibold text-ink-2">
                {t('contribute.attribution.username')}
              </label>
              <div className="relative">
                <span className="absolute start-3 top-2.5 text-sm font-bold text-muted">@</span>
                <TextInput
                  id="reporterName"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value.slice(0, 40))}
                  placeholder={t('contribute.attribution.usernamePlaceholder')}
                  className="ps-8 rounded-xl font-semibold text-ink"
                  autoComplete="off"
                />
              </div>
              {fieldErrors.reporterName && (
                <p className="text-xs font-medium text-danger">{fieldErrors.reporterName}</p>
              )}
            </div>
          )}
        </div>

        {/* 7. ANTI-SPAM VERIFICATION */}
        <div className="border-t border-line/70 pt-3">
          <GoogleCaptcha onVerify={(token) => setCaptchaToken(token)} />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 rounded-xl text-base font-bold shadow-md"
          disabled={busy || !auth.emailVerified}
        >
          {busy ? t('contribute.submitting') : t('contribute.submit')}
        </Button>

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('contribute.success.body')}
        </p>
      </form>
    </PageContainer>
  );
}
