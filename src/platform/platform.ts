/**
 * Platform adapter. Web implementations today; Capacitor-native implementations
 * (secure storage, native geolocation) can be swapped in here without touching
 * product logic. See docs/CAPACITOR.md.
 */
import { Capacitor } from '@capacitor/core';
import type { LatLng } from '../domain/geo';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage wrapper that never throws (private mode, blocked storage, SSR). */
export const safeLocalStorage: KeyValueStorage = {
  getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage unavailable: degrade silently */
    }
  },
  removeItem(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const platform = {
  isNative: Capacitor.isNativePlatform(),
  name: Capacitor.getPlatform(),
  /**
   * Storage used for the auth session. On native builds this should be replaced
   * with a maintained secure-storage plugin (Keychain/Keystore) before release.
   */
  authStorage: safeLocalStorage,
  /** Only ever called from an explicit user action — never on page load. */
  getCurrentPosition(): Promise<LatLng> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('unsupported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable')),
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
      );
    });
  },
};

export function readJson<T>(key: string, fallback: T): T {
  const raw = safeLocalStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  safeLocalStorage.setItem(key, JSON.stringify(value));
}
