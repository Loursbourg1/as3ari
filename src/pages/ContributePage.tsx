import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { ApiError, type SubmitResult } from '../data/repository';
import { addDays } from '../domain/dates';
import { formatDZD, parseMoney, parseQuantity } from '../domain/money';
import { priceReportInput } from '../domain/reportSchema';
import { normalizeUnitPrice, quantityWithinBounds, unitsForDimension } from '../domain/units';
import type { UnitCode } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { Button, ErrorState, Field, Notice, PageContainer, Select, Spinner, TextInput } from '../components/ui';

export default function ContributePage() {
  const { t, name, variant, locale } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const { catalog, shops, contributions, today, wilaya } = useAppData();
  const [params] = useSearchParams();

  const [productId, setProductId] = useState(params.get('product') ?? '');
  const [shopId, setShopId] = useState(params.get('shop') ?? '');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<UnitCode | ''>('');
  const [observedOn, setObservedOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const cat = catalog.data;
  const product = cat?.products.find((p) => p.id === productId);
  const units = product ? unitsForDimension(product.dimension) : [];
  const effectiveUnit: UnitCode | '' = unit && units.includes(unit) ? unit : (units.find((u) => u === 'kg' || u === 'l' || u === 'piece') ?? '');
  // Community reports are only accepted for real locations; demo shops are excluded.
  const realShops = (shops.data ?? []).filter((s) => !s.is_demo);

  // Display-only preview; the server recomputes the normalized price.
  const previewPrice = parseMoney(price);
  const previewQty = parseQuantity(quantity);
  const normalized = product && previewPrice && previewQty && effectiveUnit ? normalizeUnitPrice(previewPrice, previewQty, effectiveUnit, product.dimension) : null;
  const preview = normalized?.ok ? normalized : null;

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
  if (!auth.session) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!cat) return catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />;

  if (result) {
    return (
      <PageContainer className="max-w-lg">
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card" data-testid="contribute-success">
          <CheckCircle2 className="size-8 text-good" aria-hidden />
          <h1 className="mt-2 text-xl font-bold">{t('contribute.success.title')}</h1>
          <p className="mt-1 text-sm font-semibold" data-testid="report-status">
            {t('contribute.success.status', { status: t(`me.status.${result.status}`) })}
          </p>
          <p className="mt-2 text-sm text-ink-2">{t('contribute.success.body')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => { setResult(null); setPrice(''); }}>
              {t('contribute.another')}
            </Button>
            <Link to="/me" className="inline-flex h-10 items-center rounded-md border border-line-strong px-3.5 text-sm font-semibold">
              {t('contribute.viewMine')}
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fe: Record<string, string> = {};
    const p = parseMoney(price);
    const q = parseQuantity(quantity);
    if (!product) fe.product = t('errors.unknown_product');
    if (!realShops.some((s) => s.id === shopId)) fe.shop = t('errors.unknown_shop');
    if (!p) fe.price = t('errors.invalid_price');
    if (!q || !effectiveUnit || !quantityWithinBounds(q, effectiveUnit)) fe.quantity = t('errors.invalid_quantity');
    if (observedOn > today || observedOn < addDays(today, -30)) fe.date = t('errors.invalid_date');
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    const input = { product_id: productId, shop_id: shopId, price: p!, quantity: q!, unit: effectiveUnit as UnitCode, observed_on: observedOn };
    if (!priceReportInput.safeParse(input).success) {
      setError(t('errors.invalid_input'));
      return;
    }
    setBusy(true);
    try {
      setResult(await contributions.submitReport(input));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'server_error';
      setError(t(`errors.${code}` as MessageKey));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer className="max-w-lg">
      <h1 className="text-2xl font-bold">{t('contribute.title')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('contribute.intro')}</p>
      {!auth.emailVerified && (
        <div className="mt-3">
          <Notice tone="warn">{t('contribute.verifyEmail')}</Notice>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-4 space-y-3 rounded-lg border border-line bg-surface p-4 shadow-card" aria-label={t('contribute.title')}>
        <Field label={t('contribute.product')} htmlFor="product" error={fieldErrors.product}>
          <Select id="product" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">{t('contribute.chooseProduct')}</option>
            {cat.categories.map((c) => (
              <optgroup key={c.id} label={name(c)}>
                {cat.products
                  .filter((p) => p.category_id === c.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {name(p)}
                      {variant(p) ? ` — ${variant(p)}` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label={t('contribute.shop')} htmlFor="shop" error={fieldErrors.shop}>
          {realShops.length === 0 ? (
            <Notice tone="warn">{t('contribute.noShops', { area: wilaya ? name(wilaya) : '' })}</Notice>
          ) : (
            <Select id="shop" value={shopId} onChange={(e) => setShopId(e.target.value)} required>
              <option value="">{t('contribute.chooseShop')}</option>
              {realShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {t(`shop.kind.${s.kind}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('contribute.price')} htmlFor="price" error={fieldErrors.price}>
          <TextInput id="price" inputMode="decimal" autoComplete="off" placeholder="180" value={price} onChange={(e) => setPrice(e.target.value.slice(0, 12))} className="num" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('contribute.quantity')} htmlFor="quantity" error={fieldErrors.quantity}>
            <TextInput id="quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.slice(0, 10))} className="num" />
          </Field>
          <Field label={t('contribute.unit')} htmlFor="unit">
            <Select id="unit" value={effectiveUnit} onChange={(e) => setUnit(e.target.value as UnitCode)} disabled={!product}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {t(`common.unit.${u}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('contribute.date')} htmlFor="date" error={fieldErrors.date}>
          <TextInput id="date" type="date" value={observedOn} max={today} min={addDays(today, -30)} onChange={(e) => setObservedOn(e.target.value)} />
        </Field>

        {preview && (
          <p className="num text-sm text-ink-2" data-testid="price-preview">
            {t('contribute.preview', { price: formatDZD(preview.value, locale), unit: t(`common.perUnit.${preview.unit}`) })}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-danger-bg p-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !auth.emailVerified || realShops.length === 0}>
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
