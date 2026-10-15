import type { Catalog, Page, PriceObservation, ReportStatus, Shop, UnitCode, ComparisonUnit } from '../domain/types';
import type { FlagInput, PriceReportInput } from '../domain/reportSchema';

export interface ObservationQuery {
  wilayaCode?: number;
  productIds?: string[];
  shopId?: string;
  /** Only observations on/after this date (YYYY-MM-DD). */
  since?: string;
  minUnitPrice?: string;
  maxUnitPrice?: string;
  limit: number;
  offset: number;
}

export interface AreaCoverage {
  shopCount: number;
  demoShopCount: number;
  shopsWithReports: number;
  approvedReports: number;
  demoReports: number;
  lastObservedOn: string | null;
}

export interface FeedQuery {
  wilayaCode?: number;
  areaId?: string;
  categoryId?: string;
  productId?: string;
  search?: string;
  sort?: 'newest' | 'price';
  limit: number;
  offset: number;
}

/** Read-only public data. Implemented by the demo fixtures and by Supabase. */
export interface PriceRepository {
  readonly mode: 'demo' | 'live';
  loadCatalog(): Promise<Catalog>;
  listShops(wilayaCode: number): Promise<Shop[]>;
  getShop(id: string): Promise<Shop | null>;
  listObservations(q: ObservationQuery): Promise<Page<PriceObservation>>;
  listFeed(q: FeedQuery): Promise<Page<PriceObservation>>;
  areaCoverage(wilayaCode: number): Promise<AreaCoverage>;
}

export interface SubmitResult {
  id: string;
  status: ReportStatus;
  normalized_price: string;
  comparison_unit: ComparisonUnit;
}

export interface MyReport {
  id: string;
  product_id: string;
  shop_id: string;
  price: string;
  quantity: string;
  unit: UnitCode;
  normalized_price: string | null;
  comparison_unit: ComparisonUnit;
  observed_on: string;
  submitted_at: string;
  status: ReportStatus;
  rejection_reason: string | null;
}

export interface QueueItem extends MyReport {
  shop_name: string;
  contributor_id: string | null;
  open_flags: number;
  contributor_report_count: number;
}

/** Authenticated operations. All authorization is enforced by the database. */
export interface ContributionApi {
  readonly available: boolean;
  submitReport(input: PriceReportInput): Promise<SubmitResult>;
  myReports(limit: number, offset: number): Promise<MyReport[]>;
  flagReport(input: FlagInput): Promise<void>;
  isModerator(): Promise<boolean>;
  moderationQueue(status: ReportStatus | null, flaggedOnly: boolean, offset?: number): Promise<QueueItem[]>;
  moderate(reportId: string, decision: 'approve' | 'reject', note?: string): Promise<ReportStatus>;
  deleteReport(reportId: string): Promise<void>;
}

export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
