import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { config } from '../config/env';
import { supabase } from '../lib/supabase';
import { useAsync, type AsyncState } from '../lib/useAsync';
import { todayInAlgeria } from '../domain/dates';
import type { LatLng } from '../domain/geo';
import type { Catalog, Shop, Wilaya } from '../domain/types';
import { readJson, writeJson } from '../platform/platform';
import { PILOT_WILAYA_CODE } from './reference/geography';
import { createDemoRepository, unavailableContributionApi } from './demoRepository';
import { createSupabaseContributionApi, createSupabaseRepository } from './supabaseRepository';
import type { AreaCoverage, ContributionApi, PriceRepository } from './repository';

interface AppData {
  repo: PriceRepository;
  contributions: ContributionApi;
  today: string;
  catalog: AsyncState<Catalog> & { reload: () => void };
  wilayaCode: number;
  wilaya: Wilaya | undefined;
  setWilayaCode: (code: number) => void;
  shops: AsyncState<Shop[]> & { reload: () => void };
  coverage: AsyncState<AreaCoverage> & { reload: () => void };
  /** User position — only set after an explicit "Near me" action; kept in memory only. */
  origin: LatLng | null;
  setOrigin: (p: LatLng | null) => void;
}

const Ctx = createContext<AppData | null>(null);

const repo: PriceRepository = supabase
  ? createSupabaseRepository(supabase, { showDemoData: config.showDemoData })
  : createDemoRepository();
const contributions: ContributionApi = supabase ? createSupabaseContributionApi(supabase, { submitVia: config.submitVia }) : unavailableContributionApi;

export function AppDataProvider({ children, repository }: { children: ReactNode; repository?: PriceRepository }) {
  const r = repository ?? repo;
  const [wilayaCode, setCode] = useState<number>(() => {
    const saved = readJson<number | null>('as3ari.wilaya', null);
    return typeof saved === 'number' && saved >= 1 && saved <= 99 ? saved : PILOT_WILAYA_CODE;
  });
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const today = useMemo(() => todayInAlgeria(), []);

  const catalog = useAsync(() => r.loadCatalog(), [r]);
  const shops = useAsync(() => r.listShops(wilayaCode), [r, wilayaCode]);
  const coverage = useAsync(() => r.areaCoverage(wilayaCode), [r, wilayaCode]);

  const setWilayaCode = useCallback((code: number) => {
    setCode(code);
    writeJson('as3ari.wilaya', code);
  }, []);

  const value = useMemo<AppData>(
    () => ({
      repo: r,
      contributions,
      today,
      catalog,
      wilayaCode,
      wilaya: catalog.data?.wilayas.find((w) => w.code === wilayaCode),
      setWilayaCode,
      shops,
      coverage,
      origin,
      setOrigin,
    }),
    [r, today, catalog, wilayaCode, setWilayaCode, shops, coverage, origin],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside AppDataProvider');
  return v;
}

/** Catalog is required by most screens; callers render a loading state until it exists. */
export function useCatalog(): Catalog | undefined {
  return useAppData().catalog.data;
}
